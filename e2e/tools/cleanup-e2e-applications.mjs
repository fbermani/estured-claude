/**
 * Borra las solicitudes que creó la prueba E2E de escritura (solo estured-dev).
 * Uso: node --env-file=.env.local e2e/tools/cleanup-e2e-applications.mjs <ISO-desde> [--apply]
 * Solo toca solicitudes de camila.rojas@example.com creadas desde <ISO-desde>. Sin --apply solo lista.
 */
import "../../scripts/_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const since = process.argv[2];
const apply = process.argv.includes("--apply");
if (!since || Number.isNaN(Date.parse(since))) { console.error("Falta fecha ISO"); process.exit(1); }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: u } = await admin.from("users").select("id").eq("email", "camila.rojas@example.com").single();
const { data: sp } = await admin.from("student_profiles").select("id").eq("user_id", u.id).single();
const { data: apps } = await admin.from("application_requests").select("id,status,created_at").eq("student_profile_id", sp.id).gte("created_at", since);
console.log(`Solicitudes a borrar: ${apps?.length ?? 0}`, apps);
if (!apply || !apps?.length) process.exit(0);
const ids = apps.map((a) => a.id);
const step = async (label, q) => { const { error } = await q; if (error) { console.error("✗", label, error.message); process.exit(1); } console.log("✓", label); };
const { data: snaps } = await admin.from("application_snapshots").select("id").in("application_request_id", ids);
for (const t of ["application_status_events", "application_regulation_acceptances", "application_negotiation_proposals", "external_residence_payments"]) {
  await step(t, admin.from(t).delete().in("application_request_id", ids));
}
await step("application_requests", admin.from("application_requests").delete().in("id", ids));
// snapshot_original_id es NOT NULL: los snapshots se borran después de las solicitudes.
if (snaps?.length) await step("application_snapshots", admin.from("application_snapshots").delete().in("id", snaps.map((x) => x.id)));
