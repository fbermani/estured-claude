/**
 * Seed demo de clasificación de fotos (DR18 tanda 2, migración 0059): a las residencias que ya tienen fotos aprobadas les asigna
 * categorías de ejemplo (general / áreas / tipo de habitación) y destaca hasta 5. Idempotente (upsert por foto; no crea ni borra fotos).
 * Requiere la migración 0059 aplicada en estured-dev. Si la 0070 (DR30) está aplicada, también asigna secciones demo y orden
 * (aditivo: solo si la columna `section` existe; si no, se salta sin error).
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-photo-meta.mjs
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const SECTIONS = ["Living", "Cocina completa", "Comedor", "Dormitorio 1", "Baño completo", "Exterior"];
// Guard: ¿existe la columna section (migración 0070)?
const { error: secProbe } = await admin.from("residence_photo_meta").select("section").limit(1);
const hasSections = !secProbe;
if (!hasSections) console.log("• migración 0070 no aplicada: se omiten secciones demo");

const AREAS = ["cocina", "patio", "bano", "living", "comedor", "terraza"];

const { data: residences, error: rErr } = await admin.from("residences").select("id, slug").eq("status", "verified_active");
if (rErr) {
  console.error("✗ no se pudieron leer las residencias:", rErr.message);
  process.exit(1);
}
for (const r of residences ?? []) {
  const { data: files } = await admin
    .from("files")
    .select("id")
    .eq("related_entity_type", "residences")
    .eq("related_entity_id", r.id)
    .eq("document_type", "residence_photo")
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (!files || files.length === 0) continue;
  const { data: types } = await admin.from("room_types").select("id").eq("residence_id", r.id).eq("is_active", true).limit(1);
  const rows = files.map((f, i) => {
    const base = {
      file_id: f.id,
      residence_id: r.id,
      is_featured: i < 5,
      ...(hasSections ? { section: i < SECTIONS.length * 2 ? SECTIONS[Math.floor(i / 2)] : null, sort_order: i } : {}),
    };
    if (i < 2) return { ...base, category: "general", area: null, room_type_id: null };
    if (i === 2 && types?.[0]) return { ...base, category: "room_type", area: null, room_type_id: types[0].id };
    return { ...base, category: "area", area: AREAS[i % AREAS.length], room_type_id: null };
  });
  const { error } = await admin.from("residence_photo_meta").upsert(rows, { onConflict: "file_id" });
  if (error) {
    console.error("✗", r.slug, error.message, "(¿aplicaste la migración 0059?)");
    process.exit(1);
  }
  console.log("✓", r.slug, `${rows.length} fotos clasificadas`);
}
