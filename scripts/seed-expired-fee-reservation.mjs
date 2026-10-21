/**
 * Seed ADITIVO (H01, Ciclo 45): agrega al dataset demo una reserva de
 * Camila con el fee EstuRed VENCIDO (`reservations.status =
 * 'expired_fee_unpaid'`) — el estado que más se confundía con "pendiente
 * de pago" en las pantallas. `seed-demo-data.mjs` ya cubre confirmada,
 * pendiente de fee y revocada (cancelada por el estudiante); este script
 * completa el cuarto estado para poder verificar el helper de estado
 * visible (`lib/applications/visibleStatus.ts`) en pantalla.
 *
 * Uso (DESPUÉS de seed-demo-users.mjs y seed-demo-data.mjs):
 *   node --env-file=.env.local scripts/seed-expired-fee-reservation.mjs
 *
 * Idempotente: si Camila ya tiene una reserva `expired_fee_unpaid` no hace
 * nada. NO borra ni recrea filas existentes (a diferencia de
 * seed-demo-data.mjs), así que no cambia ningún UUID ya referenciado.
 * Lleva el guard de producción de todos los seeds.
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const ARS_PER_USD = 1520;
const USD = 280;
const MONTHS = 3;
const START_DATE = "2026-05-01";
const feeBaseUsd = USD * MONTHS;
const feeBaseArs = Math.round(feeBaseUsd * ARS_PER_USD);
const feeAmountArs = Math.round((feeBaseArs * 0.05) / 500) * 500;

const { data: camilaUser } = await admin.from("users").select("id").eq("email", "camila.rojas@example.com").single();
const { data: camilaProfile } = await admin
  .from("student_profiles")
  .select("id, academic_objective")
  .eq("user_id", camilaUser.id)
  .single();

const { data: existing } = await admin
  .from("reservations")
  .select("id")
  .eq("student_profile_id", camilaProfile.id)
  .eq("status", "expired_fee_unpaid")
  .limit(1);
if (existing?.length) {
  console.log("Camila ya tiene una reserva con fee vencido — nada que hacer:", existing[0].id);
  process.exit(0);
}

const { data: norte } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").single();
const { data: roomType } = await admin
  .from("room_types")
  .select("id")
  .eq("residence_id", norte.id)
  .eq("name", "Individual")
  .single();
const { data: ricardo } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();

const { data: snapshot, error: snapError } = await admin
  .from("application_snapshots")
  .insert({
    snapshot_type: "original",
    residence_id: norte.id,
    room_type_id: roomType.id,
    monthly_price_usd: USD,
    monthly_price_ars: Math.round(USD * ARS_PER_USD),
    exchange_rate_ars_per_usd: ARS_PER_USD,
    exchange_rate_source: "monedapi.ar",
    exchange_rate_date: new Date().toISOString().slice(0, 10),
    initial_duration_months: MONTHS,
    deposit_excluded_from_fee: true,
    reservation_payment_amount_usd: USD,
    reservation_payment_amount_ars: Math.round(USD * ARS_PER_USD),
    adjustment_policy: "quarterly",
    fee_base_usd: feeBaseUsd,
    fee_base_ars: feeBaseArs,
    estimated_estured_fee_ars: feeAmountArs,
  })
  .select("id")
  .single();
if (snapError) throw snapError;

const { data: app, error: appError } = await admin
  .from("application_requests")
  .insert({
    student_profile_id: camilaProfile.id,
    initiated_by: "student",
    contact_target: "student",
    residence_id: norte.id,
    room_type_id: roomType.id,
    status: "converted_to_reservation",
    desired_start_date: START_DATE,
    initial_duration_months: MONTHS,
    academic_objective: camilaProfile.academic_objective,
    snapshot_original_id: snapshot.id,
    created_by_user_id: camilaUser.id,
    contact_established_at: new Date().toISOString(),
  })
  .select("id")
  .single();
if (appError) throw appError;
await admin.from("application_snapshots").update({ application_request_id: app.id }).eq("id", snapshot.id);
await admin.from("application_status_events").insert({
  application_request_id: app.id,
  from_status: null,
  to_status: "submitted",
  changed_by_user_id: camilaUser.id,
  changed_by_role: "student",
});

const { data: erp } = await admin
  .from("external_residence_payments")
  .insert({
    application_request_id: app.id,
    residence_id: norte.id,
    student_profile_id: camilaProfile.id,
    status: "reported_received_by_residence",
    amount_reported_usd: USD,
    amount_reported_ars: Math.round(USD * ARS_PER_USD),
    payment_method_to_residence: "transfer",
    reported_received_by_user_id: ricardo.id,
    reported_received_at: new Date().toISOString(),
  })
  .select("id")
  .single();

const { data: reservation, error: resError } = await admin
  .from("reservations")
  .insert({
    application_request_id: app.id,
    student_profile_id: camilaProfile.id,
    residence_id: norte.id,
    room_type_id: roomType.id,
    status: "expired_fee_unpaid",
    start_date: START_DATE,
    initial_duration_months: MONTHS,
    academic_objective: camilaProfile.academic_objective,
    snapshot_id: snapshot.id,
    external_residence_payment_id: erp.id,
  })
  .select("id")
  .single();
if (resError) throw resError;
await admin.from("external_residence_payments").update({ reservation_id: reservation.id }).eq("id", erp.id);

const { data: fee } = await admin
  .from("estured_fee_payments")
  .insert({
    reservation_id: reservation.id,
    payer_user_id: camilaUser.id,
    beneficiary_student_profile_id: camilaProfile.id,
    status: "expired",
    fee_base_usd: feeBaseUsd,
    fee_base_ars: feeBaseArs,
    fee_amount_ars: feeAmountArs,
    payment_currency: "ARS",
    payment_provider: "manual",
    payer_billing_name: "Camila Rojas",
    payer_iva_condition: "consumidor_final",
    payment_channel: "transfer",
    expires_at: new Date(Date.now() - 72 * 3600000).toISOString(),
  })
  .select("id")
  .single();
await admin.from("reservations").update({ estured_fee_payment_id: fee.id }).eq("id", reservation.id);

console.log("✓ Camila @ Norte/Individual → RESERVA CON FEE VENCIDO (expired_fee_unpaid):", reservation.id);
