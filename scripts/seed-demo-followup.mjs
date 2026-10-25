/**
 * Seed demo del seguimiento post-ingreso (DR14, fase 3, migración 0055). ADITIVO e idempotente: no borra nada; las filas de seguimiento se
 * upsertean por `resident_stay_id` (unique) y las estadías históricas de demo se identifican por su `invite_email` de marcador.
 * Requiere la migración 0055 aplicada en estured-dev. Se niega a correr contra producción (_assert-dev-project).
 *
 * Deja:
 *  - Lucía (Río de la Plata, estadía activa): seguimiento ENVIADO sin responder + notificación con enlace → probar /students/followup/[id].
 *  - Estadía de Camila (pendiente de activar, sin cuenta): seguimiento ENVIADO solo con aviso a la residencia (sin encuesta).
 *  - Tres estadías históricas de Valentina en Norte (inactivas, no cuentan como residencia actual) con seguimientos RESPONDIDO, REVISADO
 *    (con nota interna y "comunicado") y SIN RESPUESTA → probar /admin/followups.
 * Uso: node --env-file=.env.local scripts/seed-demo-followup.mjs
 * ⚠ Si se re-corre scripts/seed-demo-data.mjs (recrea estadías con UUID nuevo) hay que re-correr este seed.
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

const probe = await admin.from("stay_followups").select("id").limit(1);
if (probe.error) {
  console.error("✗ La tabla stay_followups no existe: aplicá primero db/migrations/0055_stay_followups.sql en estured-dev.");
  process.exit(1);
}

const DAY = 86_400_000;
const ago = (n) => new Date(Date.now() - n * DAY).toISOString();
const dateAgo = (n) => ago(n).slice(0, 10);

const userByEmail = async (email) => (await admin.from("users").select("id").eq("email", email).maybeSingle()).data?.id;
const profileOf = async (email) => {
  const uid = await userByEmail(email);
  return uid ? (await admin.from("student_profiles").select("id, user_id").eq("user_id", uid).maybeSingle()).data : null;
};
const residenceBySlug = async (slug) => (await admin.from("residences").select("id").eq("slug", slug).maybeSingle()).data?.id;

const lucia = await profileOf("lucia.fernandez@example.com");
const valentina = await profileOf("valentina.sosa@example.com");
const camilaEmail = "camila.rojas@example.com";
const rio = await residenceBySlug("residencia-rio-de-la-plata-demo");
const norte = await residenceBySlug("residencia-norte-demo");
if (!lucia || !valentina || !rio || !norte) {
  console.error("✗ Faltan usuarios o residencias demo (correr scripts/seed-demo-users.mjs y seed-demo-data.mjs primero).");
  process.exit(1);
}

async function upsertFollowup(stayId, residenceId, profileId, fields) {
  const { data, error } = await admin
    .from("stay_followups")
    .upsert({ resident_stay_id: stayId, residence_id: residenceId, student_profile_id: profileId, ...fields }, { onConflict: "resident_stay_id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// 1. Lucía: enviado, sin responder.
const { data: luciaStay } = await admin
  .from("resident_stays")
  .select("id")
  .eq("student_profile_id", lucia.id)
  .eq("residence_id", rio)
  .eq("is_current", true)
  .maybeSingle();
if (luciaStay) {
  const id = await upsertFollowup(luciaStay.id, rio, lucia.id, {
    status: "sent",
    due_at: ago(1),
    sent_at: ago(1),
    residence_reminder_sent_at: ago(1),
    survey_sent_at: ago(1),
  });
  const { data: existing } = await admin.from("notifications").select("id").eq("user_id", lucia.user_id).eq("related_entity_type", "stay_followups").eq("related_entity_id", id).maybeSingle();
  if (!existing) {
    await admin.from("notifications").insert({
      user_id: lucia.user_id,
      title: "¿Cómo viene tu estadía?",
      body: "Contanos en un minuto cómo va todo hasta ahora. Tu respuesta es privada: la residencia no la ve.",
      related_entity_type: "stay_followups",
      related_entity_id: id,
    });
  }
  console.log(`✓ Lucía → seguimiento ENVIADO: /students/followup/${id}`);
} else {
  console.log("• Lucía no tiene estadía actual en Río de la Plata: se omite (re-correr seed-demo-data.mjs).");
}

// 2. Camila: estadía sin cuenta vinculada → solo aviso a la residencia.
const { data: camilaStay } = await admin
  .from("resident_stays")
  .select("id, residence_id")
  .eq("invite_email", camilaEmail)
  .is("student_profile_id", null)
  .maybeSingle();
if (camilaStay) {
  await upsertFollowup(camilaStay.id, camilaStay.residence_id, null, { status: "sent", due_at: ago(2), sent_at: ago(2), residence_reminder_sent_at: ago(2) });
  console.log("✓ Camila (estadía sin cuenta) → seguimiento ENVIADO solo con aviso a la residencia");
}

// 3. Estadías históricas de Valentina con seguimientos para el panel admin.
async function historicalStay(marker) {
  const email = `seguimiento-demo-${marker}@example.com`;
  const { data: found } = await admin.from("resident_stays").select("id").eq("invite_email", email).maybeSingle();
  if (found) return found.id;
  const { data, error } = await admin
    .from("resident_stays")
    .insert({
      student_profile_id: valentina.id,
      residence_id: norte,
      status: "inactive",
      is_current: false,
      invite_email: email,
      start_date: dateAgo(40),
      end_date: dateAgo(5),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function respond(followupId, userId, row) {
  await admin.from("stay_followup_responses").upsert(
    { stay_followup_id: followupId, respondent_user_id: userId, respondent_role: "student", answered_at: ago(8), ...row },
    { onConflict: "stay_followup_id,respondent_role" },
  );
}

const answered = await upsertFollowup(await historicalStay("respondido"), norte, valentina.id, { status: "answered", due_at: ago(12), sent_at: ago(12), survey_sent_at: ago(12), residence_reminder_sent_at: ago(12) });
await respond(answered, valentina.user_id, { how_is_it_going: "so_so", was_as_expected: "partly", comment: "La habitación es como en las fotos, pero hay mucho ruido a la noche." });

const reviewed = await upsertFollowup(await historicalStay("revisado"), norte, valentina.id, {
  status: "reviewed",
  due_at: ago(20),
  sent_at: ago(20),
  survey_sent_at: ago(20),
  residence_reminder_sent_at: ago(20),
  reviewed_at: ago(15),
  admin_note: "Contenta en general. No hace falta comunicar nada a la residencia.",
  communicated_to_residence: false,
});
await respond(reviewed, valentina.user_id, { how_is_it_going: "very_well", was_as_expected: "yes", comment: null });

await upsertFollowup(await historicalStay("sin-respuesta"), norte, valentina.id, { status: "no_response", due_at: ago(25), sent_at: ago(25), survey_sent_at: ago(25), residence_reminder_sent_at: ago(25) });
console.log("✓ Valentina @ Norte → seguimientos RESPONDIDO, REVISADO y SIN RESPUESTA (estadías históricas de demo)");
