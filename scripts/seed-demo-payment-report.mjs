/**
 * Seed ADITIVO del pago de la reserva con «Cobro con medios habilitados» (DR63 fase 5) para probar en staging:
 * deja la solicitud de Camila (camila.rojas@example.com) a Residencia Norte (demo) en `residence_payment_pending` con
 * `collection_mode = enabled_methods`, medio Transferencia en pesos, monto congelado del snapshot, datos de cobro congelados
 * (los APROBADOS de la residencia, mismo formato que `buildInstructionsSnapshot`) y plazo de 48 h desde ahora.
 *
 * Reusa la solicitud de Camila que ya está en `residence_payment_pending` en Norte (el tope de 2 activas por estudiante, 0093,
 * impide crear otra). NO toca otras solicitudes (la de Lucía no se toca). Requiere que `seed-demo-reservation-collection.mjs` haya corrido.
 *
 * Etapas (`--stage=`), para ver cada pantalla:
 *   to_pay   (por defecto) el estudiante ve la tarjeta de pago con «Ya pagué» y «No pude realizar el pago».
 *   reported «Ya pagué» avisado hace 25 h (la residencia ve el aviso y «No recibí el pago»; el job manda el recordatorio de 24 h).
 *   issue    «No pude realizar el pago» abierto (la residencia ve «Contactar por WhatsApp» / «Volver a habilitar el pago»).
 *
 * Uso (probar primero con --dry-run):
 *   node --env-file=.env.local scripts/seed-demo-payment-report.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-demo-payment-report.mjs --stage=reported
 *
 * Datos FICTICIOS de DEMO. Idempotente: pisa solo esa solicitud y su fila de pago. Se niega a correr contra producción.
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const RESIDENCE_ID = "1c4daf03-e33f-490d-a0c9-c1e46f8bb82e"; // Residencia Norte (demo)
const METHOD_KEY = "transfer_ars";
const METHOD_LABEL = "Transferencia en pesos"; // paymentMethodLabel("transfer_ars")
const dryRun = process.argv.includes("--dry-run");
const stage = (process.argv.find((a) => a.startsWith("--stage=")) ?? "--stage=to_pay").slice("--stage=".length);
if (!["to_pay", "reported", "issue"].includes(stage)) {
  console.error("--stage debe ser to_pay, reported o issue.");
  process.exit(1);
}

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

const { data: camilaUser } = await admin.from("users").select("id").eq("email", "camila.rojas@example.com").maybeSingle();
if (!camilaUser) fail("No existe camila.rojas@example.com en este proyecto (correr seed-demo-users).");
const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", camilaUser.id).maybeSingle();
if (!profile) fail("Camila no tiene perfil de estudiante.");

const { data: apps, error: appsError } = await admin
  .from("application_requests")
  .select("id, status, snapshot_original_id, snapshot_final_id")
  .eq("student_profile_id", profile.id)
  .eq("residence_id", RESIDENCE_ID)
  .eq("status", "residence_payment_pending");
if (appsError) fail(`No pude leer las solicitudes (¿migración 0102?): ${appsError.message}`);
if (!apps || apps.length === 0) {
  fail("Camila no tiene una solicitud en residence_payment_pending en Norte. Creá una desde la app (o seed-demo-data) y habilitá el pago.");
}
const app = apps[0];
const snapshotId = app.snapshot_final_id ?? app.snapshot_original_id;

const { data: account } = await admin
  .from("residence_collection_accounts")
  .select("method_label, details")
  .eq("residence_id", RESIDENCE_ID)
  .eq("method_key", METHOD_KEY)
  .maybeSingle();
if (!account?.details) fail("Norte no tiene datos de cobro APROBADOS de transferencia en pesos. Correr seed-demo-reservation-collection.mjs primero.");

const { data: snapshot } = await admin
  .from("application_snapshots")
  .select("reservation_payment_amount_usd, reservation_payment_amount_ars, monthly_price_usd, exchange_rate_ars_per_usd")
  .eq("id", snapshotId)
  .maybeSingle();
if (!snapshot) fail("No encontré el snapshot de la solicitud.");
const usd = Number(snapshot.reservation_payment_amount_usd ?? snapshot.monthly_price_usd);
const ars = snapshot.reservation_payment_amount_ars !== null && snapshot.reservation_payment_amount_ars !== undefined
  ? Number(snapshot.reservation_payment_amount_ars)
  : Math.round(usd * Number(snapshot.exchange_rate_ars_per_usd) * 100) / 100;
if (!(usd > 0) || !(ars > 0)) fail("El monto de la reserva del snapshot no es mayor a 0.");

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const deadline = new Date(Date.now() + 48 * 3_600_000).toISOString();
const paymentRow = {
  application_request_id: app.id,
  residence_id: RESIDENCE_ID,
  student_profile_id: profile.id,
  status: stage === "reported" ? "student_reported_paid" : "pending",
  chosen_method: METHOD_KEY,
  expected_amount_usd: usd,
  expected_amount_ars: ars,
  instructions_snapshot: `${METHOD_LABEL}\n${account.details.trim()}`,
  student_reported_paid_at: stage === "reported" ? hoursAgo(25) : null,
  student_payment_issue_at: stage === "issue" ? hoursAgo(2) : null,
  student_payment_issue_reason: stage === "issue" ? "Mi banco rechazó la transferencia (demo)." : null,
  student_payment_issue_resolved_at: null,
  residence_reminder_sent_at: null,
  student_reminder_sent_at: null,
  admin_alert_sent_at: null,
  student_proof_file_id: null,
  dispute_reason: null,
};

console.log(`Solicitud de Camila: ${app.id} · etapa «${stage}» · USD ${usd} / ARS ${ars}`);
if (dryRun) {
  console.log("--dry-run: no se escribió nada. Haría:");
  console.log("  application_requests: collection_mode=enabled_methods, preferred_payment_method=transfer_ars, snapshot_final_id, payment_deadline_at=ahora+48h");
  console.log("  external_residence_payments (upsert por solicitud):", { ...paymentRow, instructions_snapshot: "(datos aprobados de Norte)" });
  process.exit(0);
}

const { error: appError } = await admin
  .from("application_requests")
  .update({ collection_mode: "enabled_methods", preferred_payment_method: METHOD_KEY, snapshot_final_id: snapshotId, payment_deadline_at: deadline })
  .eq("id", app.id);
if (appError) fail(`No pude actualizar la solicitud: ${appError.message}`);

const { data: existing } = await admin.from("external_residence_payments").select("id").eq("application_request_id", app.id).maybeSingle();
const { error: payError } = existing
  ? await admin.from("external_residence_payments").update(paymentRow).eq("id", existing.id)
  : await admin.from("external_residence_payments").insert(paymentRow);
if (payError) fail(`No pude guardar el pago: ${payError.message}`);

console.log("✓ Listo. Probalo en staging:");
console.log("  - Camila (Simular usuario) → Mis solicitudes → Residencia Norte: tarjeta de pago.");
console.log("  - Ricardo (dueño de Norte) → Solicitudes: aviso del estudiante y botón «Marcar pago recibido».");
