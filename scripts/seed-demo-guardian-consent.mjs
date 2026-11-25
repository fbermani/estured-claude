/**
 * Seed del consentimiento del familiar (DR65 (e), Ola 0 legal): Martín (padre.lucia@example.com) da su consentimiento por Valentina
 * (menor demo) para que su cuenta NO quede en espera. Solo si existe un vínculo ACTIVO entre ellos. Idempotente: no duplica.
 * Para ver una cuenta en espera usá un menor sin familiar (por ejemplo, el que crea el seed de preapertura).
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-guardian-consent.mjs [--dry-run]
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: user } = await admin.from("users").select("id").eq("email", "valentina.sosa@example.com").maybeSingle();
const { data: profile } = user ? await admin.from("student_profiles").select("id").eq("user_id", user.id).maybeSingle() : { data: null };
const { data: martin } = await admin.from("users").select("id").eq("email", "padre.lucia@example.com").maybeSingle();
const { data: fm } = martin ? await admin.from("family_members").select("id").eq("user_id", martin.id).maybeSingle() : { data: null };
if (!profile || !fm) {
  console.error("✗ No encontré a Valentina o a Martín. Corré antes los seeds de usuarios (y el de confirmación del tutor para el vínculo).");
  process.exit(1);
}
const { data: link } = await admin.from("family_links").select("id").eq("student_profile_id", profile.id).eq("family_member_id", fm.id).eq("status", "active").maybeSingle();
if (!link) {
  console.error("✗ Valentina y Martín no tienen un vínculo activo. Corré antes scripts/seed-demo-guardian-confirmation.mjs.");
  process.exit(1);
}
const { data: existing } = await admin
  .from("consents")
  .select("id")
  .eq("consent_type", "guardian_consent")
  .eq("user_id", martin.id)
  .eq("related_entity_id", profile.id)
  .limit(1);
if ((existing ?? []).length > 0) {
  console.log("✓ Martín ya había dado su consentimiento por Valentina. Nada que hacer.");
  process.exit(0);
}
const row = {
  user_id: martin.id,
  consent_type: "guardian_consent",
  version: "2026-11-25+seed-demo",
  related_entity_type: "student_profiles",
  related_entity_id: profile.id,
  metadata: { family_link_id: link.id, seed: "seed-demo-guardian-consent" },
};
if (dryRun) {
  console.log("--dry-run: insertaría", row);
  process.exit(0);
}
const { error } = await admin.from("consents").insert(row);
if (error) {
  console.error("✗ No se pudo insertar:", error.code, error.message);
  process.exit(1);
}
console.log("✓ Consentimiento demo de Martín por Valentina registrado.");
