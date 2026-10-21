/**
 * Demo de disponibilidad vencida (Ciclo 48, H23): deja el tipo "Triple" de
 * Residencia Norte oculto de las búsquedas (como lo dejaría el job
 * `check_stale_availability`) y el "Individual" como "sin actualizar", así se
 * ven los avisos del Panel, la tarjeta del dashboard del owner y el admin.
 *
 * Uso (es OPT-IN: deja Norte con tipos ocultos en el catálogo):
 *   node --env-file=.env.local scripts/seed-demo-stale-availability.mjs
 *   node --env-file=.env.local scripts/seed-demo-stale-availability.mjs --restore
 *
 * `--restore` vuelve esos dos tipos a "available_to_confirm", confirmados hoy.
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
const restore = process.argv.includes("--restore");

const { data: residence } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").single();
if (!residence) {
  console.error("No encontré Residencia Norte (slug residencia-norte-demo).");
  process.exit(1);
}
const { data: types } = await admin.from("room_types").select("id, name").eq("residence_id", residence.id).in("name", ["Triple", "Individual"]);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 3600_000).toISOString();

for (const t of types ?? []) {
  const patch = restore
    ? { status: "available_to_confirm", last_confirmed_at: new Date().toISOString(), hidden_from_search_at: null }
    : t.name === "Triple"
      ? { status: "not_updated", last_confirmed_at: daysAgo(50), hidden_from_search_at: daysAgo(5) }
      : { status: "not_updated", last_confirmed_at: daysAgo(35), hidden_from_search_at: null };
  const { error } = await admin.from("profile_availability").update(patch).eq("room_type_id", t.id);
  console.log(`${t.name}: ${error ? "ERROR " + error.message : restore ? "restaurado" : "vencido"}`);
}
