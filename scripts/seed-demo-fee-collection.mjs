/**
 * Seed ADITIVO de los medios de cobro del fee de EstuRed (DR64, migración 0105) en estured-dev.
 * Deja tres medios de DEMO para ver la elección del pagador en `/students/applications/[id]/fee` y el panel `/admin/payment-settings`:
 *   - Transferencia en pesos (ARS) y Transferencia en dólares (USD): HABILITADAS.
 *   - Belo (ARS): cargada pero DESHABILITADA (sirve para ver que un medio deshabilitado no se ofrece).
 * Solo crea las filas que NO existen (por `method_key`): no pisa nada que el admin ya haya cargado y no borra nada.
 * Además deja (si no existe) una RESERVA de Camila con el fee PENDIENTE (`pending_estured_fee` / `pending_payment_method`, 48 h de plazo,
 * sin medio elegido) en Residencia Norte, para probar `/students/applications/[id]/fee` y `/admin/payments`. Crea una solicitud, un
 * snapshot, un pago a la residencia confirmado, una reserva y un fee NUEVOS: no toca ninguna fila existente (ningún UUID cambia).
 *
 * Uso (probar primero con --dry-run):
 *   node --env-file=.env.local scripts/seed-demo-fee-collection.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-demo-fee-collection.mjs
 *
 * Datos FICTICIOS de DEMO (CBU de ceros: la entidad 000 no existe). Nunca cargar datos reales desde acá.
 * Se niega a correr contra producción (`_assert-dev-project.mjs`).
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const DEMO_METHODS = [
  {
    method_key: "transfer_ars",
    currency: "ARS",
    is_enabled: true,
    details: "Titular: EstuRed (datos de prueba)\nBanco: Banco de Prueba\nAlias: estured.demo.fee\nCBU: 0000000000000000000000\nDatos de PRUEBA: no transfieras dinero real.",
  },
  {
    method_key: "transfer_usd",
    currency: "USD",
    is_enabled: true,
    details: "Titular: EstuRed (datos de prueba)\nBanco: Banco de Prueba\nAlias: estured.demo.fee.usd\nCBU: 0000000000000000000001\nCuenta en dólares de PRUEBA: no transfieras dinero real.",
  },
  {
    method_key: "belo",
    currency: "ARS",
    is_enabled: false,
    details: "Usuario de Belo: estured.demo (PRUEBA, deshabilitado).",
  },
];

const { data: existing, error: readError } = await admin.from("estured_fee_collection_methods").select("method_key");
if (readError) {
  console.error("No pude leer estured_fee_collection_methods (¿está aplicada la migración 0105?):", readError.message);
  process.exit(1);
}
const have = new Set((existing ?? []).map((r) => r.method_key));
const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").maybeSingle();

for (const method of DEMO_METHODS) {
  if (have.has(method.method_key)) {
    console.log(`= ${method.method_key}: ya existe, no se toca.`);
    continue;
  }
  if (dryRun) {
    console.log(`(dry-run) crearía ${method.method_key} (${method.currency}, ${method.is_enabled ? "habilitado" : "deshabilitado"}).`);
    continue;
  }
  const { error } = await admin.from("estured_fee_collection_methods").insert({ ...method, updated_by_user_id: adminUser?.id ?? null });
  if (error) {
    console.error(`No pude crear ${method.method_key}:`, error.message);
    process.exit(1);
  }
  console.log(`✓ ${method.method_key} creado.`);
}

// ==== Reserva de Camila con el fee pendiente (aditivo, idempotente) ====
const ARS_PER_USD = 1520;
const USD = 280;
const MONTHS = 3;
const START_DATE = "2026-12-01";
const feeBaseUsd = USD * MONTHS;
const feeBaseArs = Math.round(feeBaseUsd * ARS_PER_USD);
const feeAmountArs = Math.round((feeBaseArs * 0.05) / 500) * 500;

const { data: camilaUser } = await admin.from("users").select("id").eq("email", "camila.rojas@example.com").maybeSingle();
if (!camilaUser) {
  console.log("= No existe camila.rojas@example.com (correr seed-demo-users): se omite la reserva con fee pendiente.");
  process.exit(0);
}
const { data: camilaProfile } = await admin.from("student_profiles").select("id, academic_objective").eq("user_id", camilaUser.id).single();
const { data: pending } = await admin
  .from("reservations")
  .select("id, estured_fee_payment_id")
  .eq("student_profile_id", camilaProfile.id)
  .eq("status", "pending_estured_fee")
  .limit(1);
if (pending?.length) {
  console.log("= Camila ya tiene una reserva con el fee pendiente, no se crea otra:", pending[0].id);
  process.exit(0);
}
if (dryRun) {
  console.log("(dry-run) crearía: solicitud + snapshot + pago a la residencia confirmado + reserva pending_estured_fee + fee pending_payment_method (48 h) para Camila en Residencia Norte.");
  process.exit(0);
}

const { data: norte } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").single();
const { data: roomType } = await admin.from("room_types").select("id").eq("residence_id", norte.id).eq("name", "Individual").single();
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
    status: "pending_estured_fee",
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

const { data: fee, error: feeError } = await admin
  .from("estured_fee_payments")
  .insert({
    reservation_id: reservation.id,
    payer_user_id: camilaUser.id,
    beneficiary_student_profile_id: camilaProfile.id,
    status: "pending_payment_method",
    fee_base_usd: feeBaseUsd,
    fee_base_ars: feeBaseArs,
    fee_amount_ars: feeAmountArs,
    payment_currency: "ARS",
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
  })
  .select("id")
  .single();
if (feeError) throw feeError;
await admin.from("reservations").update({ estured_fee_payment_id: fee.id }).eq("id", reservation.id);

console.log("✓ Camila @ Norte/Individual → RESERVA CON FEE PENDIENTE (pending_estured_fee):", reservation.id);
console.log("  solicitud:", app.id, "· fee:", fee.id, "· snapshot:", snapshot.id, "· pago a la residencia:", erp.id);
