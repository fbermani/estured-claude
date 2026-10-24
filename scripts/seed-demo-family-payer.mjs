/**
 * Seed ADITIVO (Ciclo 61, DR4): deja a Martín (familiar de Lucía) como PAGADOR designado de un fee EstuRed pendiente,
 * para ver la pantalla del familiar pagador (`/students/applications/[id]/fee`) y el dashboard del familiar con una
 * "próxima acción: pagar". Crea una solicitud de Lucía convertida en reserva `pending_estured_fee` en Residencia Norte
 * (tipo de habitación distinto al de su solicitud vigente), con el fee `pending_payment_method` (plazo de 40 h) y `payer_user_id` = Martín.
 * Además deja avisos de ejemplo para Martín (solo si todavía no tiene).
 *
 * Uso (DESPUÉS de seed-demo-users.mjs y seed-demo-data.mjs):
 *   node --env-file=.env.local scripts/seed-demo-family-payer.mjs
 *
 * Idempotente: si Lucía ya tiene una reserva `pending_estured_fee` no hace nada. NO borra ni recrea filas existentes
 * (no cambia ningún UUID ya referenciado). Si la migración 0045 ya está aplicada, también carga los datos de
 * facturación de Martín (CUIT de ejemplo con verificador válido); si no, lo omite. Guard de producción incluido.
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
const USD = 320;
const MONTHS = 4;
const START_DATE = "2027-03-01";
const feeBaseUsd = USD * MONTHS;
const feeBaseArs = Math.round(feeBaseUsd * ARS_PER_USD);
const feeAmountArs = Math.round((feeBaseArs * 0.05) / 500) * 500;

const { data: lucia } = await admin.from("users").select("id").eq("email", "lucia.fernandez@example.com").single();
const { data: martin } = await admin.from("users").select("id").eq("email", "padre.lucia@example.com").single();
const { data: profile } = await admin.from("student_profiles").select("id, academic_objective").eq("user_id", lucia.id).single();

// Datos de facturación de Martín (migración 0045; CUIT 20-12345678-6 con dígito verificador válido).
const billing = await admin
  .from("family_members")
  .update({ billing_tax_id: "20123456786", billing_vat_condition: "monotributista" })
  .eq("user_id", martin.id);
console.log(billing.error ? "· Migración 0045 sin aplicar: se omiten los datos de facturación de Martín." : "✓ Facturación de Martín cargada.");

const { data: existing } = await admin
  .from("reservations")
  .select("id, application_request_id")
  .eq("student_profile_id", profile.id)
  .eq("status", "pending_estured_fee")
  .limit(1);
if (existing?.length) {
  console.log("Lucía ya tiene una reserva con fee pendiente — nada que hacer. Solicitud:", existing[0].application_request_id);
  process.exit(0);
}

// Solo hay 2 residencias demo verificadas: se usa Norte con un tipo de habitación distinto al de su solicitud vigente allí.
const { data: residence } = await admin
  .from("residences")
  .select("id, name, room_types(id, name, is_active)")
  .eq("slug", "residencia-norte-demo")
  .single();
const { data: currentApps } = await admin
  .from("application_requests")
  .select("room_type_id")
  .eq("student_profile_id", profile.id)
  .eq("residence_id", residence.id);
const usedTypes = new Set((currentApps ?? []).map((a) => a.room_type_id));
const roomType = (residence.room_types ?? []).find((t) => t.is_active && !usedTypes.has(t.id));
if (!roomType) {
  console.error("No encontré un tipo de habitación libre en Residencia Norte.");
  process.exit(1);
}
const { data: owner } = await admin.from("residence_users").select("user_id").eq("residence_id", residence.id).eq("is_active", true).limit(1).single();

const { data: snapshot, error: snapError } = await admin
  .from("application_snapshots")
  .insert({
    snapshot_type: "original",
    residence_id: residence.id,
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
    student_profile_id: profile.id,
    initiated_by: "student",
    contact_target: "student",
    residence_id: residence.id,
    room_type_id: roomType.id,
    status: "converted_to_reservation",
    desired_start_date: START_DATE,
    initial_duration_months: MONTHS,
    academic_objective: profile.academic_objective ?? "Cursar el segundo año de la carrera.",
    snapshot_original_id: snapshot.id,
    created_by_user_id: lucia.id,
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
  changed_by_user_id: lucia.id,
  changed_by_role: "student",
});

const { data: erp } = await admin
  .from("external_residence_payments")
  .insert({
    application_request_id: app.id,
    residence_id: residence.id,
    student_profile_id: profile.id,
    status: "reported_received_by_residence",
    amount_reported_usd: USD,
    amount_reported_ars: Math.round(USD * ARS_PER_USD),
    payment_method_to_residence: "transfer",
    reported_received_by_user_id: owner.user_id,
    reported_received_at: new Date().toISOString(),
  })
  .select("id")
  .single();

const { data: reservation, error: resError } = await admin
  .from("reservations")
  .insert({
    application_request_id: app.id,
    student_profile_id: profile.id,
    residence_id: residence.id,
    room_type_id: roomType.id,
    status: "pending_estured_fee",
    start_date: START_DATE,
    initial_duration_months: MONTHS,
    academic_objective: profile.academic_objective ?? "Cursar el segundo año de la carrera.",
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
    payer_user_id: martin.id,
    beneficiary_student_profile_id: profile.id,
    status: "pending_payment_method",
    fee_base_usd: feeBaseUsd,
    fee_base_ars: feeBaseArs,
    fee_amount_ars: feeAmountArs,
    expires_at: new Date(Date.now() + 40 * 3600000).toISOString(),
  })
  .select("id")
  .single();
if (feeError) throw feeError;
await admin.from("reservations").update({ estured_fee_payment_id: fee.id }).eq("id", reservation.id);

// Avisos de ejemplo para Martín (hitos y pagos, tercera persona).
const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", martin.id).eq("related_entity_id", reservation.id);
if (!count) {
  await admin.from("notifications").insert([
    {
      user_id: martin.id,
      title: "Te designaron para pagar el fee EstuRed",
      body: `Vas a pagar el fee de la reserva en ${residence.name}. Revisá el monto, los datos de transferencia y el plazo de pago.`,
      related_entity_type: "reservations",
      related_entity_id: reservation.id,
    },
    {
      user_id: martin.id,
      title: "Fee EstuRed a pagar — reserva de Lucia F.",
      body: `${residence.name} informó que recibió el pago de la reserva. Falta abonar el fee EstuRed. Si no se paga a tiempo, la reserva vence.`,
      related_entity_type: "reservations",
      related_entity_id: reservation.id,
    },
  ]);
}

console.log(`✓ Lucía @ ${residence.name} → reserva con fee pendiente, pagador = Martín. Solicitud:`, app.id);
