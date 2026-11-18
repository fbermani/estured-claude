/**
 * Seed aditivo (ficha, reglas de casa estructuradas): carga `rules.items` SOLO en `residencia-norte-demo`, con las 4 reglas del mockup
 * aprobado. No inventa reglas para residencias reales (Wanna Tango y las demás quedan como están). No borra ni recrea filas: hace
 * upsert de `residence_profile_sections` (`rules`) conservando el `summary` que ya tenía y solo si todavía no tiene `items`.
 * Idempotente; salta con un aviso si falta algo. No requiere migración (es jsonb existente).
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-house-rules.mjs
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

const ITEMS = [
  { lead: "23 a 7", title: "Silencio", detail: "Para música o videos, auriculares" },
  { lead: "7 a 23", title: "Cocina abierta", detail: "Cada uno lava y guarda lo que usa" },
  { lead: "Libre", title: "Entrada y salida", detail: "Con tu llave, sin horario de llegada" },
  { lead: "No", title: "Mascotas", detail: "Por convivencia en espacios compartidos" },
];
const toSummary = (items) => items.map((i) => `${i.lead} · ${i.title}: ${i.detail}`).join("\n");

const { data: norte, error } = await admin.from("residences").select("id, slug").eq("slug", "residencia-norte-demo").maybeSingle();
if (error) {
  console.error("✗ no se pudo leer la residencia:", error.message);
  process.exit(1);
}
if (!norte) {
  console.log("• no existe residencia-norte-demo: no hay nada que cargar");
  process.exit(0);
}
const { data: section, error: readErr } = await admin
  .from("residence_profile_sections")
  .select("content")
  .eq("residence_id", norte.id)
  .eq("section_type", "rules")
  .maybeSingle();
if (readErr) {
  console.error("✗ no se pudo leer la sección de reglas:", readErr.message);
  process.exit(1);
}
const content = section?.content ?? {};
if (Array.isArray(content.items) && content.items.length > 0) {
  console.log("• residencia-norte-demo ya tiene reglas estructuradas: sin cambios");
  process.exit(0);
}
const summary = typeof content.summary === "string" && content.summary.trim() ? content.summary : toSummary(ITEMS);
const { error: upErr } = await admin
  .from("residence_profile_sections")
  .upsert({ residence_id: norte.id, section_type: "rules", content: { ...content, summary, items: ITEMS }, requires_admin_review: false }, { onConflict: "residence_id,section_type" });
if (upErr) {
  console.error("✗ reglas de casa:", upErr.message);
  process.exit(1);
}
console.log("✓ reglas de casa estructuradas: residencia-norte-demo (4 filas)");
console.log("Listo. Mirá /residencias/residencia-norte-demo (capítulo «Reglas de casa») y el perfil en /residence/<id>/profile.");
