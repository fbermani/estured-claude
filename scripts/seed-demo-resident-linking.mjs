/**
 * Seed de vinculación de residentes (DR19, migración 0064): deja en Residencia Norte estadías pendientes con distintos estados de
 * invitación personal, el código de casa y una solicitud de vínculo de Camila, para ver `/residence/[id]/residents` (chips de invitación,
 * «Reenviar», «Mandar por WhatsApp», cola «Solicitudes de vínculo», «Código de casa») y probar `/register/student?invite=<token>`.
 *
 * REQUIERE la migración 0064 (`db/migrations/0064_resident_linking.sql`) aplicada en estured-dev. Si no está, avisa y sale sin tocar nada.
 * Los enlaces personales se imprimen UNA vez (en la base solo queda el hash). NO manda mails.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-resident-linking.mjs
 * Idempotente: borra las estadías demo de este script (emails `*.vinculo@estured.test` / nombres «… Demo») y las recrea con tokens nuevos.
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

const probe = await admin.from("resident_stay_invitations").select("id", { head: true, count: "exact" });
if (probe.error) {
  console.error(`✗ La tabla resident_stay_invitations no existe todavía (${probe.error.code}). Aplicá antes db/migrations/0064_resident_linking.sql en el SQL Editor de estured-dev.`);
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

// Limpieza de lo sembrado antes (las invitaciones caen por cascade).
await admin.from("resident_stays").delete().eq("residence_id", residenceId).like("invite_email", "%.vinculo@estured.test");
await admin.from("resident_stays").delete().eq("residence_id", residenceId).is("invite_email", null).like("invite_name", "% Demo");

await admin.from("residence_private_details").update({ house_code: "NRT7K3" }).eq("residence_id", residenceId);

const mint = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
};
const DAY = 86_400_000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

async function stay(fields) {
  const { data, error } = await admin
    .from("resident_stays")
    .insert({ residence_id: residenceId, status: "pending_activation", is_current: true, created_by_residence_user_id: owner.id, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
async function invite(stayId, channel, extra = {}) {
  const { token, hash } = mint();
  const { error } = await admin.from("resident_stay_invitations").insert({
    resident_stay_id: stayId,
    residence_id: residenceId,
    token_hash: hash,
    channel,
    created_by: owner.id,
    expires_at: iso(now + 14 * DAY),
    sent_at: channel === "email" ? iso(now) : null,
    send_count: channel === "email" ? 1 : 0,
    ...extra,
  });
  if (error) throw error;
  return `${appUrl}/register/student?invite=${token}`;
}

const mateo = await stay({ invite_email: "mateo.vinculo@estured.test", invite_name: "Mateo Demo" });
const linkMateo = await invite(mateo, "email");

const julieta = await stay({ invite_email: null, invite_name: "Julieta Demo", invite_phone: "5491100000000" });
const linkJulieta = await invite(julieta, "whatsapp");

const tomas = await stay({ invite_email: "tomas.vinculo@estured.test", invite_name: "Tomás Demo" });
await invite(tomas, "email", { declined_at: iso(now - DAY), revoked_at: iso(now - DAY), revoke_reason: "declined" });

const paula = await stay({ invite_email: "paula.vinculo@estured.test", invite_name: "Paula Demo" });
await invite(paula, "email", { expires_at: iso(now - 2 * DAY) });

// Solicitud de vínculo de Camila (si no tiene ya una estadía vigente).
const { data: camila } = await admin.from("users").select("id").eq("email", "camila.rojas@example.com").maybeSingle();
const { data: profile } = camila ? await admin.from("student_profiles").select("id").eq("user_id", camila.id).maybeSingle() : { data: null };
if (profile) {
  const { data: housed } = await admin.from("resident_stays").select("id").eq("student_profile_id", profile.id).eq("is_current", true).limit(1);
  await admin.from("resident_link_requests").delete().eq("student_profile_id", profile.id).eq("residence_id", residenceId);
  if (!housed || housed.length === 0) {
    await admin.from("resident_link_requests").insert({
      student_profile_id: profile.id,
      residence_id: residenceId,
      status: "pending",
      message: "Vivo en la habitación 2B desde marzo.",
      via_house_code: true,
    });
    console.log("• Solicitud de vínculo pendiente de Camila Rojas creada.");
  } else {
    console.log("• Camila ya tiene una estadía vigente: no se creó la solicitud de vínculo.");
  }
}

console.log("\nResidencia Norte — vinculación de residentes (DR19)");
console.log("• Código de casa: NRT7K3");
console.log(`• Mateo Demo (mail, invitación enviada)  → ${linkMateo}`);
console.log(`• Julieta Demo (sin mail, WhatsApp)       → ${linkJulieta}`);
console.log("• Tomás Demo: respondió «no soy yo» · Paula Demo: invitación vencida");
console.log("Los enlaces se imprimen una sola vez. Ver /residence/<id>/residents como Ricardo (owner).");
