/**
 * Seed de fichas de residencias REALES del CRM (Documents/EstuRed/Archivos/crm-residencias-caba-estured.md).
 * Datos reales (nombre, dirección, coordenadas, descripción, servicios, fotos de su web) sacados por investigación y
 * guardados en scripts/data/crm-residencias/*.json; las fotos viven en scripts/data/crm-fotos/ (gitignored: son de terceros).
 * FICTICIOS a propósito: tarifas, condiciones, tipos de habitación, disponibilidad y residentes.
 * Las 2 universidades más cercanas se calculan por distancia real con lib/data/buenosAiresUniversities.ts.
 *
 * SOLO estured-dev: son negocios reales con precios inventados; jamás a producción.
 * Idempotente: upsert por slug, tipos por (residencia, nombre), secciones por (residencia, tipo), fotos solo si no tiene.
 *
 * Uso: node --env-file=.env.local scripts/seed-crm-residencias.mjs
 * Después (residentes ficticios): CRM=1 TARGET=12 node --env-file=.env.local scripts/seed-residence-community.mjs
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const must = (r, ctx) => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data;
};

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "scripts", "data", "crm-residencias");
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

// Universidades (dataset único de la app) parseadas del .ts
const uniSrc = readFileSync(join(ROOT, "lib", "data", "buenosAiresUniversities.ts"), "utf-8");
const UNIS = [...uniSrc.matchAll(/\{ name: "([^"]+)", lat: (-?[\d.]+), lng: (-?[\d.]+) \}/g)].map((m) => ({ name: m[1], lat: +m[2], lng: +m[3] }));
const km = (a, b) => {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
};
const nearestUnis = (lat, lng, n = 2) => UNIS.map((u) => ({ ...u, d: km({ lat, lng }, u) })).sort((a, b) => a.d - b.d).slice(0, n).map((u) => u.name);

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const base = must(await admin.from("residences").select("created_by").eq("slug", "residencia-norte-demo").single(), "residencia base");
const ownerId = base.created_by;
const rate = Number((await admin.from("exchange_rates").select("official_exchange_rate_ars_per_usd").order("rate_date", { ascending: false }).limit(1)).data?.[0]?.official_exchange_rate_ars_per_usd ?? 1480);

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
let ok = 0, skipped = 0;
for (const f of files) {
  const r = JSON.parse(readFileSync(join(DATA_DIR, f), "utf-8"));
  if (r.status !== "ok" || r.lat == null || r.lng == null || !r.description) {
    console.log(`- ${r.slug}: se omite (${r.status}${r.lat == null ? ", sin coordenadas" : ""})`);
    skipped += 1;
    continue;
  }
  const h = hash(r.slug);
  const fields = {
    name: r.name, slug: r.slug, tagline: (r.tagline ?? "").slice(0, 80) || null, property_type: "residencia_estudiantil", description: r.description, status: "verified_active",
    address_line: r.address_line, public_area: r.barrio, city: "CABA", latitude: r.lat, longitude: r.lng, created_by: ownerId,
    // Condiciones FICTICIAS
    minimum_stay_months: [3, 6, 6, 12][h % 4], adjustment_policy: ["quarterly", "semiannual", "quarterly", "monthly"][(h >> 2) % 4],
    deposit_usd: [150, 200, 250, 300][(h >> 3) % 4], empty_month_charge_percent: [0, 50, 50, 100][(h >> 4) % 4],
    reservation_initial_payment_mode: "one_month", reservation_initial_payment_usd: null,
    min_resident_age: r.min_age ?? 18, max_resident_age: r.max_age ?? null, accepts_minors: false,
  };
  const found = (await admin.from("residences").select("id").eq("slug", r.slug).maybeSingle()).data;
  let residenceId;
  if (found) {
    residenceId = found.id;
    must(await admin.from("residences").update(fields).eq("id", residenceId), `update ${r.slug}`);
  } else {
    residenceId = must(await admin.from("residences").insert(fields).select("id").single(), `insert ${r.slug}`).id;
    must(await admin.from("residence_private_details").upsert({ residence_id: residenceId, responsible_name: "Responsable demo", responsible_contact: "+54 9 11 0000-0000" }, { onConflict: "residence_id" }), "private");
    must(await admin.from("residence_verifications").insert({ residence_id: residenceId, status: "not_started" }), "verif");
  }

  for (const s of [
    { section_type: "services", content: { items: r.services ?? [] } },
    { section_type: "common_areas", content: { items: r.common_areas ?? [] } },
    { section_type: "near_universities", content: { items: nearestUnis(r.lat, r.lng) } },
  ]) must(await admin.from("residence_profile_sections").upsert({ residence_id: residenceId, ...s }, { onConflict: "residence_id,section_type" }), `seccion ${s.section_type}`);

  // Tipos de habitación FICTICIOS (los mismos 4 para todas; precio y disponibilidad varían por hash)
  const bump = 1 + ((h % 21) - 10) / 100; // ±10 %
  const TYPES = [
    ["Individual", 1, 430, "privado", [2, 1, 0, 3][h % 4]],
    ["Doble", 2, 320, "compartido", [1, 2, 3, 0][(h >> 1) % 4]],
    ["Triple", 3, 250, "compartido", [0, 2, 1, 4][(h >> 2) % 4]],
    ["Cuádruple", 4, 200, "compartido", [3, 0, 2, 1][(h >> 3) % 4]],
  ];
  for (const [name, cap, usd0, bath, count] of TYPES) {
    const usd = Math.round((usd0 * bump) / 5) * 5;
    const tf = { residence_id: residenceId, name, gender_policy: r.gender_policy ?? "mixto", bathroom_type: bath, features: ["Ventana", "Escritorio", "Ropero individual"], capacity_per_room: cap, monthly_price_usd: usd, monthly_price_ars: Math.round(usd * rate), is_active: true };
    const ex = (await admin.from("room_types").select("id").eq("residence_id", residenceId).eq("name", name).maybeSingle()).data;
    const typeId = ex ? (must(await admin.from("room_types").update(tf).eq("id", ex.id), `tipo ${name}`), ex.id) : must(await admin.from("room_types").insert(tf).select("id").single(), `tipo ${name}`).id;
    const av = { residence_id: residenceId, room_type_id: typeId, status: count > 0 ? "available_to_confirm" : "full", available_count: count, last_confirmed_by: ownerId, available_from: count > 0 ? new Date().toISOString().slice(0, 10) : null, last_confirmed_at: new Date().toISOString() };
    const exAv = (await admin.from("profile_availability").select("id").eq("room_type_id", typeId).maybeSingle()).data;
    if (exAv) must(await admin.from("profile_availability").update(av).eq("id", exAv.id), "disp");
    else must(await admin.from("profile_availability").insert(av), "disp");
  }

  // Fotos reales de su web → Storage + files
  const has = (await admin.from("files").select("id", { count: "exact", head: true }).eq("related_entity_id", residenceId).eq("document_type", "residence_photo")).count;
  let up = 0;
  if (!has) {
    for (const rel of r.photos ?? []) {
      const p = join(ROOT, rel);
      if (!existsSync(p) || !MIME[extname(p).toLowerCase()]) continue;
      const size = statSync(p).size;
      if (size > 5 * 1024 * 1024) continue;
      const storagePath = `${residenceId}/${Date.now()}-${basename(p).replace(/[^a-zA-Z0-9.\-]/g, "-")}`;
      const mime = MIME[extname(p).toLowerCase()];
      const { error: upErr } = await admin.storage.from("public-residence-media").upload(storagePath, readFileSync(p), { contentType: mime, upsert: false });
      if (upErr) { console.log(`  x ${rel}: ${upErr.message}`); continue; }
      must(await admin.from("files").insert({ owner_user_id: ownerId, related_entity_type: "residences", related_entity_id: residenceId, bucket: "public-residence-media", storage_path: storagePath, filename: basename(p), mime_type: mime, size_bytes: size, visibility: "public", document_type: "residence_photo", status: "approved", uploaded_by_user_id: ownerId }), "files");
      up += 1;
    }
  }
  console.log(`✓ ${r.slug} (${r.barrio}) unis: ${nearestUnis(r.lat, r.lng).join(" | ")} · fotos nuevas: ${up}`);
  ok += 1;
}
console.log(`\nListo: ${ok} fichas, ${skipped} omitidas.`);
