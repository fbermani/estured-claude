/**
 * Seed aditivo: selecciona FAQ-36 «¿Qué cosas tengo que llevar?» (esencial) con respuesta completa en las residencias DEMO
 * (slug que termina en `-demo`) que todavía no la tienen. No toca residencias reales: su contenido lo carga cada residencia.
 * Idempotente (no pisa filas existentes). Requiere la migración 0054.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-faq-que-llevar.mjs
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

const ANSWER =
  "Llevá ropa de cama, toallas, artículos de higiene personal y un candado para el locker. La residencia provee la habitación amoblada y la cocina equipada. No se permiten electrodomésticos de alto consumo en las habitaciones.";

const { data: residences, error } = await admin.from("residences").select("id, slug").like("slug", "%-demo");
if (error) {
  console.error(error.message);
  process.exit(1);
}
const { data: existing } = await admin.from("residence_faq_items").select("residence_id").eq("predefined_question_id", "FAQ-36");
const have = new Set((existing ?? []).map((e) => e.residence_id));

let n = 0;
for (const r of residences ?? []) {
  if (have.has(r.id)) continue;
  const { error: e } = await admin
    .from("residence_faq_items")
    .insert({ residence_id: r.id, predefined_question_id: "FAQ-36", is_selected: true, answer_override: ANSWER });
  if (e) {
    console.error("✗", r.slug, e.message);
    process.exit(1);
  }
  console.log("✓", r.slug);
  n++;
}
console.log(`Listo: FAQ-36 cargada en ${n} residencias demo.`);
