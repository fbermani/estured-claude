import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertAdminsOfAuditFailure, createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import {
  REVOCATION_RESOLVED_TITLE,
  deniedNotificationBody,
  refundedNotificationBody,
} from "@/lib/revocations/copy";
import {
  evaluateRevocationResolution,
  type RevocationDecision,
  type RevocationResolutionInput,
} from "@/lib/revocations/evaluateResolution";

export type ResolveFeeRevocationResult =
  | { ok: true; decision: RevocationDecision }
  | { ok: false; error: string; code?: "migration_pending" };

const MIGRATION_PENDING_MESSAGE =
  "Todavía no se puede registrar la resolución: falta aplicar la migración 0049 en esta base de datos.";

const CLOSED_CASE_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];

/**
 * "Resolver revocación" (DR6, docs/00 §31, docs/04 §8.9, docs/07 §18.6bis): el admin reintegra el fee completo o deniega la
 * revocación, siempre con motivo obligatorio. El reintegro real se hace por fuera de la plataforma; acá solo se registra.
 *
 * Capa de I/O sobre `evaluateRevocationResolution` (reglas puras): lee la reserva y el fee, evalúa, escribe con un UPDATE
 * CONDICIONAL (`status = 'paid'` y `revocation_resolution is null`) para que una doble resolución o una carrera entre dos admins no
 * pueda pisar nada, audita (alertando a los admins si el log falla, como el resto de las operaciones de dinero), cierra el caso de
 * Soporte y avisa in-app. Cerrar el caso y avisar son best-effort: nunca revierten la resolución.
 * Solo se llama desde una server action que ya comprobó rol admin/superadmin; recibe el cliente service role.
 */
export async function resolveFeeRevocation(
  admin: SupabaseClient,
  params: {
    reservationId: string;
    actorUserId: string;
    actorRole: "admin" | "superadmin";
    input: RevocationResolutionInput;
  },
): Promise<ResolveFeeRevocationResult> {
  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id, status, cancellation_reason_code, cancelled_at, student_profile_id, estured_fee_payment_id, residences(name)")
    .eq("id", params.reservationId)
    .maybeSingle();
  if (reservationError) {
    console.error("[revocation-resolve] reservation query failed:", reservationError);
    return { ok: false, error: "No pudimos leer la reserva. Probá de nuevo." };
  }
  if (!reservation) return { ok: false, error: "No encontramos esa reserva." };
  if (!reservation.estured_fee_payment_id) return { ok: false, error: "Esta reserva no tiene un fee pagado." };

  const { data: fee, error: feeError } = await admin
    .from("estured_fee_payments")
    .select("id, status, paid_at, fee_amount_ars, payment_currency, payer_user_id, revocation_resolution")
    .eq("id", reservation.estured_fee_payment_id)
    .maybeSingle();
  if (feeError) {
    if (isMissingSchemaError(feeError)) return { ok: false, error: MIGRATION_PENDING_MESSAGE, code: "migration_pending" };
    console.error("[revocation-resolve] fee query failed:", feeError);
    return { ok: false, error: "No pudimos leer el pago del fee. Probá de nuevo." };
  }
  if (!fee) return { ok: false, error: "No encontramos el pago del fee de esta reserva." };

  const evaluation = evaluateRevocationResolution({
    facts: {
      reservationStatus: reservation.status as string,
      cancellationReasonCode: (reservation.cancellation_reason_code as string | null) ?? null,
      revokedAt: (reservation.cancelled_at as string | null) ?? null,
      feeStatus: fee.status as string,
      feeAmountArs: Number(fee.fee_amount_ars),
      paidAt: (fee.paid_at as string | null) ?? null,
      revocationResolution: (fee.revocation_resolution as string | null) ?? null,
      paymentCurrency: (fee.payment_currency as string | null) ?? null,
    },
    input: params.input,
    actorUserId: params.actorUserId,
  });
  if (!evaluation.ok) return { ok: false, error: evaluation.error };

  // Update condicional: solo gana quien encuentra el fee todavía `paid` y sin resolución.
  const { data: updated, error: updateError } = await admin
    .from("estured_fee_payments")
    .update(evaluation.patch)
    .eq("id", fee.id)
    .eq("status", "paid")
    .is("revocation_resolution", null)
    .select("id");
  if (updateError) {
    if (isMissingSchemaError(updateError)) return { ok: false, error: MIGRATION_PENDING_MESSAGE, code: "migration_pending" };
    console.error("[revocation-resolve] update failed:", updateError);
    return { ok: false, error: "No pudimos guardar la resolución. Revisá los datos e intentá de nuevo." };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Esta revocación ya fue resuelta (probablemente por otra persona). Recargá la pantalla para ver el resultado." };
  }

  const residenceName = (reservation.residences as unknown as { name: string } | null)?.name ?? null;
  const isRefund = evaluation.decision === "refunded";
  const studentMessage = (evaluation.patch.revocation_student_message as string | null) ?? null;

  const audited = await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: isRefund ? "estured_fee_refunded_after_revocation" : "estured_fee_revocation_denied",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    reasonText: evaluation.patch.revocation_internal_reason as string,
    oldValue: { status: fee.status, revocation_resolution: null },
    newValue: {
      reservation_id: reservation.id,
      decision: evaluation.decision,
      within_window: evaluation.window.withinWindow,
      day_number: evaluation.window.dayNumber,
      justified_cause: params.input.justifiedCause,
      student_message_set: Boolean(studentMessage),
      ...(isRefund
        ? {
            refund_amount_ars: evaluation.patch.refund_amount_ars,
            refund_method: evaluation.patch.refund_method,
            // Solo los últimos 4 caracteres: la referencia completa vive únicamente en la fila del fee (solo service role).
            refund_reference_last4: String(evaluation.patch.refund_reference).slice(-4),
            refunded_at: evaluation.patch.refunded_at,
            ...(fee.payment_currency === "USD" ? { fee_paid_in_usd_refund_recorded_in_ars: true } : {}),
          }
        : {}),
    },
    source: "admin",
  });
  if (!audited) {
    await alertAdminsOfAuditFailure(admin, {
      action: isRefund ? "estured_fee_refunded_after_revocation" : "estured_fee_revocation_denied",
      entityType: "estured_fee_payments",
      entityId: fee.id,
    });
  }

  await closeRevocationSupportCase(admin, {
    reservationId: reservation.id as string,
    actorUserId: params.actorUserId,
    isRefund,
    studentMessage,
  });
  await notifyStudentAndPayer(admin, {
    studentProfileId: reservation.student_profile_id as string,
    payerUserId: (fee.payer_user_id as string | null) ?? null,
    reservationId: reservation.id as string,
    body: isRefund
      ? refundedNotificationBody({ residenceName, refundedAtIso: evaluation.refundedAtIso! })
      : deniedNotificationBody({ residenceName, studentMessage }),
  });

  return { ok: true, decision: evaluation.decision };
}

/**
 * Cierra el caso de Soporte `fee_revocation` de la reserva. Se escribe directo (sin `updateSupportCaseStatus`) porque esa función
 * copia las notas a la notificación del estudiante y acá el motivo interno no puede salir: `resolution_notes` del caso lo lee quien
 * abrió el caso, así que solo lleva el mensaje para el estudiante o un texto genérico. Best-effort: nunca lanza.
 */
async function closeRevocationSupportCase(
  admin: SupabaseClient,
  params: { reservationId: string; actorUserId: string; isRefund: boolean; studentMessage: string | null },
): Promise<void> {
  try {
    const { data: cases, error } = await admin
      .from("support_cases")
      .select("id, status")
      .eq("topic", "fee_revocation")
      .eq("related_entity_id", params.reservationId);
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[revocation-resolve] support case lookup failed:", error);
      return;
    }
    const open = (cases ?? []).filter((c) => !CLOSED_CASE_STATUSES.includes(c.status as string));
    for (const supportCase of open) {
      const { error: updateError } = await admin
        .from("support_cases")
        .update({
          status: params.isRefund ? "admin_action_taken" : "closed_no_action",
          resolution_outcome: params.isRefund ? "estured_fee_refund" : "closed_no_action",
          resolution_notes:
            params.studentMessage ?? (params.isRefund ? "Revocación resuelta: se reintegró el fee." : "Revocación resuelta: no correspondió reintegrar el fee."),
          assigned_admin_user_id: params.actorUserId,
        })
        .eq("id", supportCase.id);
      if (updateError) console.error("[revocation-resolve] support case close failed:", updateError);
    }
  } catch (e) {
    console.error("[revocation-resolve] support case close threw:", e);
  }
}

/** Aviso in-app al estudiante y, si es otra persona con vínculo activo, al pagador del fee. Best-effort. */
async function notifyStudentAndPayer(
  admin: SupabaseClient,
  params: { studentProfileId: string; payerUserId: string | null; reservationId: string; body: string },
): Promise<void> {
  try {
    const { data: student } = await admin.from("student_profiles").select("user_id").eq("id", params.studentProfileId).maybeSingle();
    const recipients = new Set<string>();
    if (student?.user_id) recipients.add(student.user_id as string);
    // Al estudiante siempre; al pagador solo si sigue con vínculo familiar activo con ese estudiante (si no, no se le filtra nada).
    if (params.payerUserId && params.payerUserId !== student?.user_id) {
      const { data: link } = await admin
        .from("family_links")
        .select("id, family_members!inner(user_id)")
        .eq("student_profile_id", params.studentProfileId)
        .eq("status", "active")
        .eq("family_members.user_id", params.payerUserId)
        .maybeSingle();
      if (link) recipients.add(params.payerUserId);
    }
    await Promise.all(
      [...recipients].map((userId) =>
        createNotification(admin, {
          userId,
          title: REVOCATION_RESOLVED_TITLE,
          body: params.body,
          relatedEntityType: "fee_revocations",
          relatedEntityId: params.reservationId,
        }),
      ),
    );
  } catch (e) {
    console.error("[revocation-resolve] notify failed:", e);
  }
}
