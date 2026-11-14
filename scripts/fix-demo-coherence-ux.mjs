/**
 * Normalización ADITIVA/puntual de datos demo (auditorías UX 2026-11-14, CON-21 y CON-30). Solo UPDATE de filas demo
 * conocidas por email; no crea ni borra filas. Idempotente. Por defecto SIMULA; `--apply` escribe.
 *
 *   node --env-file=.env.local scripts/fix-demo-coherence-ux.mjs [--apply] [--coherencia-lucia]
 *
 * Siempre (CON-30): «Lucia»→«Lucía» (student_profiles de lucia.fernandez@example.com) y «Martin»→
 * «Martín» (family_members de padre.lucia@example.com). NO toca snapshots fiscales (payer_billing_name).
 *
 * Solo con `--coherencia-lucia` (CON-21, decisión del dueño): la reserva confirmada de Lucía en Residencia Norte tiene
 * start_date distinto del inicio de su estadía activa (seed-arrival-demo.mjs la mueve a «hoy + N»; la estadía queda en
 * 2026-07-20) y por eso el estudiante ve 20/07/2026 y el familiar 15/02/2027. Iguala reserva.start_date a
 * resident_stays.start_date. Efecto: deja de verse la tarjeta «Tu llegada» (DR29) hasta re-correr seed-arrival-demo.
 *
 * No resuelve: el mail «padre.lucia@…» que se ve como tutor de Valentina (Martín está vinculado a ambas; cambiar el
 * email rompería seeds/tests con el email fijo; ver reporte CON-30).
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const coherencia = process.argv.includes("--coherencia-lucia");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = (m) => console.log(`${apply ? "[APLICA]" : "[SIMULA]"} ${m}`);

async function userId(email) {
  const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}
async function patch(table, match, patchObj, label) {
  const { data } = await admin.from(table).select("*").match(match).maybeSingle();
  if (!data) return log(`${label}: fila no encontrada, se omite`);
  const diff = Object.entries(patchObj).filter(([k, v]) => data[k] !== v);
  if (diff.length === 0) return log(`${label}: ya está normalizado`);
  log(`${label}: ${diff.map(([k, v]) => `${k} «${data[k]}» → «${v}»`).join(", ")}`);
  if (apply) {
    const { error } = await admin.from(table).update(patchObj).eq("id", data.id);
    if (error) console.error(`  ✗ ${error.message}`);
  }
}

const luciaId = await userId("lucia.fernandez@example.com");
const martinId = await userId("padre.lucia@example.com");
if (luciaId) await patch("student_profiles", { user_id: luciaId }, { first_name: "Lucía" }, "Lucía (perfil)");
if (martinId) await patch("family_members", { user_id: martinId }, { first_name: "Martín" }, "Martín (familiar)");

if (coherencia && luciaId) {
  const { data: sp } = await admin.from("student_profiles").select("id").eq("user_id", luciaId).maybeSingle();
  const { data: stay } = await admin.from("resident_stays").select("reservation_id,start_date").eq("student_profile_id", sp?.id).eq("is_current", true).eq("status", "active").not("reservation_id", "is", null).maybeSingle();
  if (stay) await patch("reservations", { id: stay.reservation_id }, { start_date: stay.start_date }, "Reserva de Lucía (start_date = inicio de estadía)");
  else log("Lucía no tiene estadía activa con reserva: se omite");
}
if (!apply) console.log("Simulación: no se escribió nada. Repetir con --apply.");
