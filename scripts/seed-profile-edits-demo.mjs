/**
 * Seed demo de /admin/profile-edits (migración 0027). ADITIVO e idempotente: solo CREA filas nuevas ficticias en
 * `residence_profile_edits` con estado `pending_admin_review` (docs/04) y las marca con review_notes = MARK.
 * No modifica ni borra filas existentes (salvo con --delete, que borra únicamente las marcadas).
 * Uso: node --env-file=.env.local scripts/seed-profile-edits-demo.mjs [--delete]
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const MARK = "[demo:seed-profile-edits]";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

if (process.argv.includes("--delete")) {
  const { data, error } = await admin.from("residence_profile_edits").delete().eq("review_notes", MARK).select("id");
  if (error) throw error;
  console.log(`✓ Borradas ${data.length} ediciones demo.`);
  process.exit(0);
}

const exists = await admin.from("residence_profile_edits").select("id").eq("review_notes", MARK);
if (exists.error) throw exists.error;
if (exists.data.length > 0) {
  console.log(`= Ya hay ${exists.data.length} ediciones demo; nada que crear.`);
  process.exit(0);
}

const { data: res } = await admin
  .from("residences")
  .select("id, name, slug")
  .eq("status", "verified_active")
  .order("created_at")
  .limit(2);
if (!res?.length) {
  console.error("No hay residencias verified_active.");
  process.exit(1);
}
const { data: ownerLink } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").maybeSingle();
const submitter =
  (await admin.from("users").select("id").eq("role", "residence_owner").limit(1).maybeSingle()).data?.id ?? ownerLink?.id;
if (!submitter) {
  console.error("No hay usuario para submitted_by.");
  process.exit(1);
}

const rows = [
  {
    residence_id: res[0].id,
    field_group: "minimum_stay_months",
    old_value: { months: 3 },
    new_value: { months: 6 },
  },
  {
    residence_id: (res[1] ?? res[0]).id,
    field_group: "services",
    old_value: { items: ["Wi-Fi", "Limpieza semanal"] },
    new_value: { items: ["Wi-Fi", "Limpieza semanal", "Lavadero", "Sala de estudio"] },
  },
].map((r) => ({ ...r, status: "pending_admin_review", submitted_by: submitter, review_notes: MARK }));

const { data, error } = await admin.from("residence_profile_edits").insert(rows).select("id, field_group");
if (error) throw error;
console.log("✓ Creadas:", data);
