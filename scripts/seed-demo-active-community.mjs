/**
 * Demo del filtro «Con comunidad activa» de /search: la comunidad (residentes visibles) solo se muestra en las
 * residencias con Gestión Operativa (Premium), así que le activa ese acceso a las residencias demo con más
 * residentes cargados hasta llegar a TARGET (por defecto 12, contando las que ya lo tienen). Además les crea
 * habitaciones (la tarjeta muestra «N plazas ›» solo si hay capacidad declarada) y reparte a sus residentes
 * existentes en ellas, sin crear residentes nuevos: se reutilizan los de la comunidad que ya está cargada.
 * Solo estured-dev. Idempotente: no toca las que ya tienen el acceso.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-active-community.mjs
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const TARGET = Number(process.env.TARGET ?? 12);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, ctx) => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data;
};

const residences = must(await admin.from("residences").select("id, name, has_operational_management_access").eq("status", "verified_active"), "residencias");
const stays = must(await admin.from("resident_stays").select("residence_id").eq("is_current", true).neq("status", "hidden_by_user").neq("status", "inactive"), "residentes");
const count = {};
for (const s of stays) count[s.residence_id] = (count[s.residence_id] ?? 0) + 1;

const already = residences.filter((r) => r.has_operational_management_access === true && (count[r.id] ?? 0) > 0);
const missing = Math.max(0, TARGET - already.length);
const candidates = residences
  .filter((r) => r.has_operational_management_access !== true && (count[r.id] ?? 0) > 0)
  .sort((a, b) => (count[b.id] ?? 0) - (count[a.id] ?? 0) || a.name.localeCompare(b.name, "es"))
  .slice(0, missing);

const until = new Date();
until.setFullYear(until.getFullYear() + 1);
for (const r of candidates) {
  must(
    await admin
      .from("residences")
      .update({ has_operational_management_access: true, pioneer_free_access_until: until.toISOString().slice(0, 10) })
      .eq("id", r.id),
    `activar ${r.name}`,
  );
  console.log(`✓ ${r.name} (${count[r.id]} residentes)`);
}
console.log(`\nCon comunidad activa: ${already.length} ya estaban + ${candidates.length} nuevas = ${already.length + candidates.length} (objetivo ${TARGET}).`);

// Habitaciones: «N plazas» sale de habitaciones activas × plazas por tipo. Solo se completan las residencias sin
// habitaciones; por tipo alcanzan para sus residentes y sobra una habitación libre.
const withCommunity = [...already, ...candidates];
for (const r of withCommunity) {
  const existing = must(await admin.from("rooms").select("id").eq("residence_id", r.id).limit(1), `habitaciones de ${r.name}`);
  if (existing.length > 0) continue;
  const types = must(await admin.from("room_types").select("id, name, capacity_per_room").eq("residence_id", r.id).eq("is_active", true).order("capacity_per_room"), `tipos de ${r.name}`);
  const resStays = must(await admin.from("resident_stays").select("id, room_type_id").eq("residence_id", r.id).eq("is_current", true).neq("status", "hidden_by_user").neq("status", "inactive"), `residentes de ${r.name}`);
  let places = 0;
  for (const t of types) {
    const cap = Math.max(1, t.capacity_per_room ?? 1);
    const mine = resStays.filter((s) => s.room_type_id === t.id);
    const n = Math.ceil(mine.length / cap) + 1;
    const rooms = [];
    for (let i = 0; i < n; i++) {
      rooms.push(must(await admin.from("rooms").insert({ residence_id: r.id, room_type_id: t.id, label: `${t.name} ${i + 1}`, sort_order: i + 1 }).select("id").single(), `crear habitación de ${r.name}`));
    }
    places += n * cap;
    for (let i = 0; i < mine.length; i++) {
      must(await admin.from("resident_stays").update({ room_id: rooms[Math.floor(i / cap)].id }).eq("id", mine[i].id), "asignar residente");
    }
  }
  console.log(`✓ ${r.name}: ${places} plazas`);
}
