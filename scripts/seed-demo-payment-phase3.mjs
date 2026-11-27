/**
 * Seed ADITIVO de la fase 3 de pesos y pago (DR73, DR74) para ver en staging. Crea dos solicitudes nuevas a Residencia Norte (demo) en
 * `residence_payment_pending`, clonadas de la solicitud pausada de Camila (mismo snapshot y tipo de habitación). NO toca las solicitudes
 * de Camila (la de `contact_established` la usa `seed-demo-instagram-estados.mjs`).
 *
 *   1. Lucía (lucia.fernandez@example.com): contacto directo, plazo en 10 h. Ve «Ya pagué» y «Abrir un caso en Soporte».
 *   2. Micaela (micaela.sanchez@example.com): medios habilitados, plazo vencido hace 2 h y un caso de Soporte de pago abierto.
 *      Ve «Hay un caso abierto en Soporte… El plazo queda frenado», sin «Plazo vencido». Al cerrar el caso desde /admin/support-cases
 *      corre el plazo nuevo de 24 h.
 *
 * Idempotente: usa ids fijos; al re-correr borra y recrea solo esas filas. Datos FICTICIOS. Se niega a correr contra producción.
 * Requiere `seed-demo-reservation-collection.mjs` (datos de cobro aprobados de Norte) y la migración 0112.
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-demo-payment-phase3.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-demo-payment-phase3.mjs
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const RESIDENCE_ID = "1c4daf03-e33f-490d-a0c9-c1e46f8bb82e"; // Residencia Norte (demo)
const SOURCE_APP_ID = "9c567a4b-ad09-4f13-b3cf-ded567c1eac0"; // solicitud pausada de Camila (solo se lee)
const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const hours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

const CASES = [
  {
    email: "lucia.fernandez@example.com",
    appId: "d7300000-0000-4000-8000-000000000001",
    snapId: "d7300000-0000-4000-8000-000000000011",
    mode: "whatsapp_direct",
    deadline: hours(10),
    openCase: false,
  },
  {
    email: "micaela.sanchez@example.com",
    appId: "d7300000-0000-4000-8000-000000000002",
    snapId: "d7300000-0000-4000-8000-000000000012",
    mode: "enabled_methods",
    deadline: hours(-2),
    openCase: true,
  },
];
const CASE_ID = "d7300000-0000-4000-8000-000000000022";

const { data: source } = await admin.from("application_requests").select("*").eq("id", SOURCE_APP_ID).maybeSingle();
if (!source) fail(`No existe la solicitud de origen ${SOURCE_APP_ID}.`);
const sourceSnapId = source.snapshot_final_id ?? source.snapshot_original_id;
const { data: snapshot } = await admin.from("application_snapshots").select("*").eq("id", sourceSnapId).maybeSingle();
if (!snapshot) fail("No encontré el snapshot de origen.");
const { data: account } = await admin
  .from("residence_collection_accounts")
  .select("details")
  .eq("residence_id", RESIDENCE_ID)
  .eq("method_key", "transfer_ars")
  .maybeSingle();
if (!account?.details) fail("Norte no tiene datos de cobro aprobados de transferencia (correr seed-demo-reservation-collection.mjs).");
const usd = Number(snapshot.reservation_payment_amount_usd ?? snapshot.monthly_price_usd);
const ars = snapshot.reservation_payment_amount_ars != null ? Number(snapshot.reservation_payment_amount_ars) : Math.round(usd * Number(snapshot.exchange_rate_ars_per_usd));

for (const c of CASES) {
  const { data: user } = await admin.from("users").select("id").eq("email", c.email).maybeSingle();
  if (!user) fail(`No existe ${c.email}.`);
  const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) fail(`${c.email} no tiene perfil de estudiante.`);
  console.log(`${c.email}: ${c.appId} · ${c.mode} · plazo ${c.deadline}${c.openCase ? " · caso abierto" : ""}`);
  if (dryRun) continue;

  // Limpieza de una corrida anterior (solo estas filas).
  await admin.from("support_cases").delete().eq("related_entity_id", c.appId);
  await admin.from("external_residence_payments").delete().eq("application_request_id", c.appId);
  await admin.from("application_status_events").delete().eq("application_request_id", c.appId);
  await admin.from("notifications").delete().eq("related_entity_id", c.appId);
  const { error: delError } = await admin.from("application_requests").delete().eq("id", c.appId); // el snapshot cae en cascada
  if (delError) fail(`No pude borrar la corrida anterior: ${delError.message}`);
  await admin.from("application_snapshots").delete().eq("id", c.snapId);

  // Orden del alta real: snapshot sin solicitud → solicitud con el snapshot → se vincula el snapshot.
  const now = new Date().toISOString();
  const { error: snapError } = await admin.from("application_snapshots").insert({ ...snapshot, id: c.snapId, application_request_id: null, created_at: now });
  if (snapError) fail(`No pude crear el snapshot: ${snapError.message}`);

  const { error: appError } = await admin.from("application_requests").insert({
    ...source,
    id: c.appId,
    student_profile_id: profile.id,
    family_link_id: null,
    family_proposal_id: null,
    stay_change_intent_id: null,
    active_request_group_id: null,
    place_id: null,
    contact_target: "student",
    status: "residence_payment_pending",
    snapshot_original_id: c.snapId,
    snapshot_final_id: c.snapId,
    proposal_count: 0,
    collection_mode: c.mode,
    preferred_payment_method: c.mode === "enabled_methods" ? "transfer_ars" : null,
    contact_established_at: hours(-30),
    payment_deadline_at: c.deadline,
    expires_at: hours(48),
    created_by_user_id: user.id,
    regulation_acceptance_pending: false,
    created_at: now,
    updated_at: now,
  });
  if (appError) fail(`No pude crear la solicitud: ${appError.message}`);

  await admin.from("application_snapshots").update({ application_request_id: c.appId }).eq("id", c.snapId);

  const { error: payError } = await admin.from("external_residence_payments").insert({
    application_request_id: c.appId,
    residence_id: RESIDENCE_ID,
    student_profile_id: profile.id,
    status: "pending",
    chosen_method: c.mode === "enabled_methods" ? "transfer_ars" : null,
    expected_amount_usd: c.mode === "enabled_methods" ? usd : null,
    expected_amount_ars: c.mode === "enabled_methods" ? ars : null,
    instructions_snapshot: c.mode === "enabled_methods" ? `Transferencia en pesos\n${account.details.trim()}` : null,
  });
  if (payError) fail(`No pude crear el pago: ${payError.message}`);

  if (c.openCase) {
    const { error: caseError } = await admin.from("support_cases").insert({
      id: CASE_ID,
      opened_by_user_id: user.id,
      opened_by_role: "student",
      topic: "residence_payment",
      residence_id: RESIDENCE_ID,
      related_entity_type: "application_requests",
      related_entity_id: c.appId,
      description: "Hice la transferencia pero el banco la dejó en revisión. ¿Qué hago? (demo)",
      terms_reminder_accepted_at: now,
    });
    if (caseError) fail(`No pude abrir el caso: ${caseError.message}`);
  }
}

console.log(dryRun ? "--dry-run: no se escribió nada." : "✓ Listo. En staging: Lucía y Micaela → Mis solicitudes → Residencia Norte; Ricardo (dueño de Norte) → Solicitudes.");
