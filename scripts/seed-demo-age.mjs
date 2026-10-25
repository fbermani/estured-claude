/**
 * Seed demo de edad de residentes (DR14, migración 0052): deja la Residencia Norte demo con rango 18–26 y,
 * si existe, una segunda residencia demo que acepta menores (desde 16). Idempotente (solo UPDATE; no crea ni borra filas).
 * Requiere la migración 0052 aplicada en estured-dev.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-age.mjs
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

const TARGETS = [
  { slug: "residencia-norte-demo", min_resident_age: 18, max_resident_age: 26, accepts_minors: false, label: "rango 18–26" },
  { slug: "casa-almagro-demo", min_resident_age: 16, max_resident_age: null, accepts_minors: true, label: "acepta menores (desde 16)" },
];

for (const t of TARGETS) {
  const { label, slug, ...patch } = t;
  const { data, error } = await admin.from("residences").update(patch).eq("slug", slug).select("id");
  if (error) {
    console.error("✗", slug, error.message, "(¿aplicaste la migración 0052?)");
    process.exit(1);
  }
  console.log(data?.length ? `✓ ${slug}: ${label}` : `· ${slug} no existe (correr antes seed-demo-data.mjs); se omite`);
}
