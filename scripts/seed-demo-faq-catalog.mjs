/**
 * Seed aditivo del catálogo de FAQ (DR14, fase 2b) para la Residencia Norte demo. Requiere la migración 0054 (que ya carga las 49
 * preguntas del catálogo). Idempotente: hace upsert por (residencia, pregunta), no duplica ni toca otras residencias.
 *
 *   - FAQ-02 y FAQ-10 («EstuRed fija»): seleccionadas, sin edición.
 *   - FAQ-25, FAQ-26, FAQ-32 y FAQ-37: seleccionadas con los campos `{…}` ya completados.
 *   - FAQ-07: guardada SIN mostrar y con campos sin completar (para ver el aviso de «completá los datos» en la pantalla).
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-faq-catalog.mjs
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

const { data: residence } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").maybeSingle();
if (!residence) {
  console.error("No existe residencia-norte-demo. Correr antes scripts/seed-demo-data.mjs");
  process.exit(1);
}

const { count, error: catalogError } = await admin
  .from("residence_faq_predefined_questions")
  .select("id", { count: "exact", head: true });
if (catalogError || !count) {
  console.error(
    "El catálogo no está disponible (¿falta aplicar db/migrations/0054_faq_catalog.sql en estured-dev? Pegala en el SQL Editor).",
    catalogError?.message ?? "",
  );
  process.exit(1);
}

const ITEMS = [
  { id: "FAQ-02", is_selected: true, answer_override: null },
  { id: "FAQ-10", is_selected: true, answer_override: null },
  {
    id: "FAQ-25",
    is_selected: true,
    answer_override:
      "No, podés entrar y salir libremente. La entrada principal se cierra de noche y se abre con tu llave. Respetá el silencio de 23:00 a 7:00.",
  },
  { id: "FAQ-26", is_selected: true, answer_override: "Se guarda silencio de 23:00 a 7:00. Para música o videos, auriculares." },
  {
    id: "FAQ-32",
    is_selected: true,
    answer_override:
      "Sí, de 7:00 a 23:00. Cada habitación tiene un frigobar chico y también hay heladera compartida. Cada uno lava y guarda lo que usa.",
  },
  {
    id: "FAQ-37",
    is_selected: true,
    answer_override: "Sí, hay lavandería con cronograma en el cartel del primer piso, sin costo adicional de uso.",
  },
  // Borrador: sin mostrar y con campos pendientes (usa la respuesta sugerida, que trae {campos}).
  { id: "FAQ-07", is_selected: false, answer_override: null },
];

for (const item of ITEMS) {
  const { error } = await admin.from("residence_faq_items").upsert(
    {
      residence_id: residence.id,
      predefined_question_id: item.id,
      is_selected: item.is_selected,
      answer_override: item.answer_override,
    },
    { onConflict: "residence_id,predefined_question_id" },
  );
  if (error) {
    console.error("✗", item.id, error.message);
    process.exit(1);
  }
  console.log(`✓ ${item.id} ${item.is_selected ? "(se muestra)" : "(sin mostrar)"}`);
}
console.log("Listo. Mirá /residencias/residencia-norte-demo (sección Preguntas) y /residence/<id>/faq.");
