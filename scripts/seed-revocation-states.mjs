/**
 * Seed ADITIVO (Ciclo 68, DR6): completa el dataset demo con los estados de la revocación del fee para poder verificar
 * "Resolver revocación" (Actividad → Revocaciones) y la pantalla del estudiante (/students/revocation):
 *   - una revocación REINTEGRADA de Camila (fee `refunded`, con fecha, medio, referencia y mensaje al estudiante);
 *   - una revocación DENEGADA de Camila (revocada fuera de los 10 días, con mensaje al estudiante);
 *   - un caso de Soporte `fee_revocation` abierto para cada revocación SIN resolver que no lo tenga (p. ej. la del 20/10 de
 *     `seed-demo-data.mjs`, que se creó antes de existir el caso automático).
 * La revocación PENDIENTE ya la crea `seed-demo-data.mjs` (Camila @ Norte/Doble, "Pagado — sin reembolso" hasta resolverla).
 *
 * REQUIERE la migración 0049 aplicada en estured-dev (si no, avisa y sale sin tocar nada).
 * Uso (DESPUÉS de seed-demo-users.mjs y seed-demo-data.mjs):
 *   node --env-file=.env.local scripts/seed-revocation-states.mjs
 *
 * Idempotente: no recrea lo que ya existe (marca por `start_date` 2026-03-01 / 2026-04-01 + revocación). NO borra ni recrea filas
 * existentes, así que no cambia ningún UUID ya referenciado. Lleva el guard de producción de todos los seeds.
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

const probe = await admin.from("estured_fee_payments").select("revocation_resolution").limit(1);
if (probe.error) {
  console.error(
    "La migración 0049 todavía no está aplicada en esta base (falta estured_fee_payments.revocation_resolution).\n" +
      "Aplicala en el SQL Editor de estured-dev (db/migrations/0049_revocation_resolution.sql) y volvé a correr este script.",
  );
  process.exit(1);
}

const ARS_PER_USD = 1520;
const DAY = 24 * 3600000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();

const { data: camilaUser } = await admin.from("users").select("id").eq("email", "camila.rojas@example.com").single();
const { data: camilaProfile } = await admin
  .from("student_profiles")
  .select("id, academic_objective")
  .eq("user_id", camilaUser.id)
  .single();
const { data: norte } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").single();
const { data: roomType } = await admin.from("room_types").select("id").eq("residence_id", norte.id).eq("name", "Individual").single();
const { data: ricardo } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
const { data: adminRole } = await admin.from("user_roles").select("user_id").in("role", ["admin", "superadmin"]).limit(1).single();
const adminUserId = adminRole.user_id;

async function createRevokedReservation({ startDate, usd, months, paidDaysAgo, revokedDaysAgo, reason, resolution }) {
  const { data: existing } = await admin
    .from("reservations")
    .select("id")
    .eq("student_profile_id", camilaProfile.id)
    .eq("start_date", startDate)
    .eq("cancellation_reason_code", "student_revocation_right")
    .limit(1);
  if (existing?.length) {
    console.log(`Ya existe la revocación de ${startDate} — nada que hacer:`, existing[0].id);
    return;
  }

  const feeBaseUsd = usd * months;
  const feeBaseArs = Math.round(feeBaseUsd * ARS_PER_USD);
  const feeAmountArs = Math.round((feeBaseArs * 0.05) / 500) * 500;

  const { data: snapshot, error: snapError } = await admin
    .from("application_snapshots")
    .insert({
      snapshot_type: "original",
      residence_id: norte.id,
      room_type_id: roomType.id,
      monthly_price_usd: usd,
      monthly_price_ars: Math.round(usd * ARS_PER_USD),
      exchange_rate_ars_per_usd: ARS_PER_USD,
      exchange_rate_source: "monedapi.ar",
      exchange_rate_date: new Date().toISOString().slice(0, 10),
      initial_duration_months: months,
      deposit_excluded_from_fee: true,
      reservation_payment_amount_usd: usd,
      reservation_payment_amount_ars: Math.round(usd * ARS_PER_USD),
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
      desired_start_date: startDate,
      initial_duration_months: months,
      academic_objective: camilaProfile.academic_objective,
      snapshot_original_id: snapshot.id,
      created_by_user_id: camilaUser.id,
      contact_established_at: daysAgo(paidDaysAgo + 3),
    })
    .select("id")
    .single();
  if (appError) throw appError;
  await admin.from("application_snapshots").update({ application_request_id: app.id }).eq("id", snapshot.id);

  const { data: erp } = await admin
    .from("external_residence_payments")
    .insert({
      application_request_id: app.id,
      residence_id: norte.id,
      student_profile_id: camilaProfile.id,
      status: "reported_received_by_residence",
      amount_reported_usd: usd,
      amount_reported_ars: Math.round(usd * ARS_PER_USD),
      payment_method_to_residence: "transfer",
      reported_received_by_user_id: ricardo.id,
      reported_received_at: daysAgo(paidDaysAgo + 1),
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
      status: "cancelled_by_student",
      cancellation_reason_code: "student_revocation_right",
      cancelled_at: daysAgo(revokedDaysAgo),
      confirmed_at: daysAgo(paidDaysAgo),
      start_date: startDate,
      initial_duration_months: months,
      academic_objective: camilaProfile.academic_objective,
      snapshot_id: snapshot.id,
      external_residence_payment_id: erp.id,
    })
    .select("id")
    .single();
  if (resError) throw resError;
  await admin.from("external_residence_payments").update({ reservation_id: reservation.id }).eq("id", erp.id);

  const resolutionFields =
    resolution.kind === "refunded"
      ? {
          status: "refunded",
          refunded_at: daysAgo(resolution.refundedDaysAgo),
          refund_amount_ars: feeAmountArs,
          refund_method: "bank_transfer",
          refund_reference: "OP-DEMO-0001",
          revocation_resolution: "refunded",
        }
      : { status: "paid", revocation_resolution: "denied" };
  const { data: fee, error: feeError } = await admin
    .from("estured_fee_payments")
    .insert({
      reservation_id: reservation.id,
      payer_user_id: camilaUser.id,
      beneficiary_student_profile_id: camilaProfile.id,
      fee_base_usd: feeBaseUsd,
      fee_base_ars: feeBaseArs,
      fee_amount_ars: feeAmountArs,
      payment_currency: "ARS",
      payment_provider: "manual",
      payer_billing_name: "Camila Rojas",
      payer_iva_condition: "consumidor_final",
      payment_channel: "transfer",
      paid_at: daysAgo(paidDaysAgo),
      expires_at: daysAgo(paidDaysAgo - 2),
      revocation_resolved_at: daysAgo(resolution.resolvedDaysAgo),
      revocation_resolved_by: adminUserId,
      revocation_internal_reason: resolution.internalReason,
      revocation_student_message: resolution.studentMessage,
      ...resolutionFields,
    })
    .select("id")
    .single();
  if (feeError) throw feeError;
  await admin.from("reservations").update({ estured_fee_payment_id: fee.id }).eq("id", reservation.id);

  await admin.from("audit_logs").insert({
    actor_user_id: camilaUser.id,
    actor_role: "student",
    action: "estured_fee_revoked",
    entity_type: "reservations",
    entity_id: reservation.id,
    reason_text: reason,
    new_value: { estured_fee_payment_id: fee.id },
    source: "user",
  });
  // Caso de Soporte ya cerrado, como lo deja `resolveFeeRevocation`.
  await admin.from("support_cases").insert({
    opened_by_user_id: camilaUser.id,
    opened_by_role: "student",
    topic: "fee_revocation",
    residence_id: null,
    related_entity_type: "reservations",
    related_entity_id: reservation.id,
    description: `Revocación del fee EstuRed de la reserva en Residencia Norte. Motivo indicado: ${reason}`,
    status: resolution.kind === "refunded" ? "admin_action_taken" : "closed_no_action",
    resolution_outcome: resolution.kind === "refunded" ? "estured_fee_refund" : "closed_no_action",
    resolution_notes: resolution.studentMessage,
    assigned_admin_user_id: adminUserId,
  });
  console.log(`✓ Camila @ Norte/Individual → revocación ${resolution.kind === "refunded" ? "REINTEGRADA" : "DENEGADA"}:`, reservation.id);
}

await createRevokedReservation({
  startDate: "2026-03-01",
  usd: 260,
  months: 3,
  paidDaysAgo: 12,
  revokedDaysAgo: 9, // día 4 de 10: dentro de plazo
  reason: "Cambié de facultad y ya no voy a mudarme.",
  resolution: {
    kind: "refunded",
    resolvedDaysAgo: 6,
    refundedDaysAgo: 6,
    internalReason: "Dentro de plazo y sin indicios de acuerdo por fuera de la plataforma. Reintegro total.",
    studentMessage: "Te transferimos el fee completo. Si no lo ves en tu cuenta en un par de días, escribinos por Soporte.",
  },
});

await createRevokedReservation({
  startDate: "2026-04-01",
  usd: 240,
  months: 4,
  paidDaysAgo: 15,
  revokedDaysAgo: 2, // día 14: fuera de plazo (no debería poder revocar desde la UI; sirve para ver "Fuera de plazo")
  reason: "Prefiero otra residencia.",
  resolution: {
    kind: "denied",
    resolvedDaysAgo: 1,
    internalReason: "Revocación fuera de los 10 días corridos desde el pago del fee. Sin causa para reintegro.",
    studentMessage: "La revocación llegó después de los 10 días corridos desde el pago, por eso no correspondió reintegrar el fee.",
  },
});

// Casos de Soporte para las revocaciones sin resolver que todavía no tengan el suyo.
const { data: pending } = await admin
  .from("reservations")
  .select("id, residences(name), estured_fee_payments!reservations_estured_fee_payment_fk (status, revocation_resolution)")
  .eq("status", "cancelled_by_student")
  .eq("cancellation_reason_code", "student_revocation_right");
for (const r of pending ?? []) {
  const fee = r.estured_fee_payments;
  if (!fee || fee.status !== "paid" || fee.revocation_resolution) continue;
  const { data: cases } = await admin.from("support_cases").select("id").eq("topic", "fee_revocation").eq("related_entity_id", r.id).limit(1);
  if (cases?.length) continue;
  const { data: log } = await admin
    .from("audit_logs")
    .select("actor_user_id, actor_role, reason_text")
    .eq("action", "estured_fee_revoked")
    .eq("entity_id", r.id)
    .limit(1)
    .maybeSingle();
  if (!log?.actor_user_id) continue;
  const { error } = await admin.from("support_cases").insert({
    opened_by_user_id: log.actor_user_id,
    opened_by_role: log.actor_role === "family_member" ? "family_member" : "student",
    topic: "fee_revocation",
    residence_id: null,
    related_entity_type: "reservations",
    related_entity_id: r.id,
    description:
      `Revocación del fee EstuRed de la reserva${r.residences?.name ? ` en ${r.residences.name}` : ""}, ejercida dentro del plazo de 10 días corridos. EstuRed revisa el caso.` +
      (log.reason_text ? ` Motivo indicado: ${log.reason_text}` : ""),
  });
  if (error) throw error;
  console.log("✓ Caso de Soporte fee_revocation abierto para la revocación pendiente:", r.id);
}
