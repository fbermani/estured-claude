/**
 * Seed de invitaciones al equipo demo (Ciclo 73, DR10): deja en Residencia Norte una invitación pendiente vigente y una vencida, para ver
 * la pantalla "Equipo" (`/residence/[id]/team`) con Ricardo (dueño) y probar el enlace de aceptación `/register/staff/[token]`.
 *
 * REQUIERE la migración 0051 (`db/migrations/0051_residence_team_invitations.sql`) aplicada en estured-dev. Si no está, el script avisa y sale
 * sin tocar nada. NO crea cuentas ni vínculos: la aceptación real crea al staff.
 *
 * DR11 (Ciclo 74): la invitación vigente lleva el atajo «Atención de solicitudes» y la vencida los valores por defecto. Con `--staff-permissions`
 * también deja a Sofía (staff.norte@estured.test) en Norte con «Atención de solicitudes», para ver la interfaz del staff con permisos
 * apagados (por defecto NO toca sus permisos: sin permisos guardados rige el comportamiento anterior a DR11).
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-demo-team.mjs [--staff-permissions]
 *
 * Idempotente: borra las invitaciones demo de este script (emails `*.equipo@estured.test`) y las vuelve a crear con tokens nuevos. El enlace de
 * la invitación vigente se imprime UNA vez (en la base solo queda el hash). No toca otras filas.
 */
import "./_assert-dev-project.mjs";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const probe = await admin.from("residence_team_invitations").select("id", { head: true, count: "exact" });
if (probe.error) {
  console.error(`✗ La tabla residence_team_invitations no existe todavía (${probe.error.code}). Aplicá antes db/migrations/0051_residence_team_invitations.sql en el SQL Editor de estured-dev.`);
  process.exit(1);
}

const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
const { data: link } = await admin
  .from("residence_users")
  .select("residence_id")
  .eq("user_id", owner.id)
  .eq("role", "owner")
  .eq("is_active", true)
  .order("created_at", { ascending: true })
  .limit(1)
  .single();
const residenceId = link.residence_id;

await admin.from("residence_team_invitations").delete().eq("residence_id", residenceId).like("email", "%.equipo@estured.test");

const mint = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
};
const KEYS = [
  "applications.review_contact",
  "applications.reject",
  "payments.residence",
  "applications.send_adjustment",
  "operations.rooms_availability",
  "residents.manage",
  "renewals.manage",
  "waitlist.manage",
  "faq.manage",
  "profile.edit",
];
const mapOf = (enabled) => Object.fromEntries(KEYS.map((k) => [k, enabled.includes(k)]));
// Mismos atajos que la pantalla Equipo (lib/residences/permissions.ts).
const ATENCION = mapOf(["applications.review_contact", "applications.reject", "payments.residence", "waitlist.manage", "faq.manage"]);
const POR_DEFECTO = mapOf(KEYS.filter((k) => k !== "applications.send_adjustment" && k !== "profile.edit"));
const day = 24 * 3600_000;
const valid = mint();
const expired = mint();

const { error } = await admin.from("residence_team_invitations").insert([
  {
    residence_id: residenceId,
    email: "pendiente.equipo@estured.test",
    permissions: ATENCION,
    token_hash: valid.hash,
    invited_by: owner.id,
    expires_at: new Date(Date.now() + 5 * day).toISOString(),
    last_sent_at: new Date(Date.now() - 2 * day).toISOString(),
  },
  {
    residence_id: residenceId,
    email: "vencida.equipo@estured.test",
    permissions: POR_DEFECTO,
    token_hash: expired.hash,
    invited_by: owner.id,
    expires_at: new Date(Date.now() - 2 * day).toISOString(),
    last_sent_at: new Date(Date.now() - 9 * day).toISOString(),
  },
]);
if (error) {
  console.error("✗ No se pudieron crear las invitaciones demo:", error.message);
  process.exit(1);
}
console.log("✓ Invitaciones demo creadas en la residencia", residenceId);
console.log(`  Enlace de la invitación vigente (pendiente.equipo@estured.test): ${appUrl}/register/staff/${valid.token}`);

if (process.argv.includes("--staff-permissions")) {
  const { data: sofia } = await admin.from("users").select("id").eq("email", "staff.norte@estured.test").single();
  const { error: permError } = await admin
    .from("residence_users")
    .update({ permissions: ATENCION })
    .eq("residence_id", residenceId)
    .eq("user_id", sofia.id)
    .eq("role", "staff");
  if (permError) console.error("✗ No se pudieron guardar los permisos de Sofía:", permError.message);
  else console.log("✓ Sofía (staff.norte@estured.test) quedó en Norte con «Atención de solicitudes». Para volver al comportamiento anterior: update residence_users set permissions = '{}' ...");
}
