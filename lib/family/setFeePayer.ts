import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { loadActiveFamilyOfStudent } from "@/lib/family/access";

export type SetFeePayerResult = { ok: true; payerUserId: string } | { ok: false; error: string };

/**
 * El estudiante designa quién paga el fee EstuRed de una reserva (DR4: el familiar vinculado puede PAGAR, ser el
 * `payer_user_id`; docs/05 §4.5: "las reservas que el estudiante le asigna como pagador"). SUPUESTO REVERSIBLE
 * (docs/00 §31, DR4-b): el estudiante elige entre pagar él mismo o que pague su familiar vinculado ACTIVO, solo mientras el
 * fee espera el pago (`pending_payment_method`) y la reserva sigue en `pending_estured_fee`. Una vez que hay un comprobante
 * cargado ya no se cambia. El familiar no se auto-designa: lo decide el estudiante.
 */
export async function setFeePayer(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; payer: "self" | "family" },
): Promise<SetFeePayerResult> {
  const { data: application, error: applicationError } = await admin
    .from("application_requests")
    .select("id, status, student_profile_id, residences(name), student_profiles(user_id)")
    .eq("id", params.applicationId)
    .maybeSingle();
  if (applicationError) {
    console.error("[family] setFeePayer: no se pudo leer la solicitud:", applicationError);
    return { ok: false, error: "No pudimos cambiar quién paga. Probá de nuevo en unos minutos." };
  }
  const studentUserId = (application?.student_profiles as unknown as { user_id: string } | null)?.user_id;
  if (!application || studentUserId !== params.actorUserId) {
    return { ok: false, error: "No encontramos esa solicitud." };
  }

  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id, status, estured_fee_payment_id")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (reservationError) {
    console.error("[family] setFeePayer: no se pudo leer la reserva:", reservationError);
    return { ok: false, error: "No pudimos cambiar quién paga. Probá de nuevo en unos minutos." };
  }
  if (!reservation?.estured_fee_payment_id || reservation.status !== "pending_estured_fee") {
    return { ok: false, error: "El fee de esta reserva ya no está pendiente." };
  }

  const { data: fee, error: feeError } = await admin
    .from("estured_fee_payments")
    .select("id, status, payer_user_id, expires_at")
    .eq("id", reservation.estured_fee_payment_id)
    .maybeSingle();
  if (feeError) {
    console.error("[family] setFeePayer: no se pudo leer el fee:", feeError);
    return { ok: false, error: "No pudimos cambiar quién paga. Probá de nuevo en unos minutos." };
  }
  if (!fee || fee.status !== "pending_payment_method") {
    return { ok: false, error: "Ya hay un pago en curso: no se puede cambiar quién paga." };
  }
  if (fee.expires_at && new Date(fee.expires_at as string) < new Date()) {
    return { ok: false, error: "El plazo para pagar este fee ya venció." };
  }

  let newPayerUserId = params.actorUserId;
  let family: Awaited<ReturnType<typeof loadActiveFamilyOfStudent>> = null;
  if (params.payer === "family") {
    family = await loadActiveFamilyOfStudent(admin, application.student_profile_id as string);
    if (!family) return { ok: false, error: "No tenés un familiar vinculado activo para designar como pagador." };
    if (family.permissions.can_pay_estured_fee !== true) {
      return { ok: false, error: "Tu familiar no tiene permitido pagar el fee." };
    }
    newPayerUserId = family.userId;
  }
  if (fee.payer_user_id === newPayerUserId) return { ok: true, payerUserId: newPayerUserId };

  // Compare-and-set: no pisa un cambio concurrente ni un comprobante recién cargado.
  const { data: updated, error } = await admin
    .from("estured_fee_payments")
    .update({ payer_user_id: newPayerUserId })
    .eq("id", fee.id)
    .eq("status", "pending_payment_method")
    .eq("payer_user_id", fee.payer_user_id)
    .select("id");
  if (error || !updated || updated.length === 0) {
    if (error) console.error("[family] setFeePayer failed:", error);
    return { ok: false, error: "No pudimos cambiar quién paga. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "estured_fee_payer_changed",
    entityType: "estured_fee_payments",
    entityId: fee.id as string,
    oldValue: { payer_user_id: fee.payer_user_id },
    newValue: { payer_user_id: newPayerUserId },
  });

  const residenceName = (application.residences as unknown as { name: string } | null)?.name ?? "la residencia";
  if (family) {
    await createNotification(admin, {
      userId: family.userId,
      title: "Te designaron para pagar el fee EstuRed",
      body: `Vas a pagar el fee de la reserva en ${residenceName}. Revisá el monto, los datos de transferencia y el plazo de pago.`,
      relatedEntityType: "reservations",
      relatedEntityId: reservation.id as string,
    });
  } else if (fee.payer_user_id !== params.actorUserId) {
    // Volvió a pagar el estudiante: el familiar designado antes se entera.
    await createNotification(admin, {
      userId: fee.payer_user_id as string,
      title: "Ya no sos el pagador del fee EstuRed",
      body: `El pago del fee de la reserva en ${residenceName} lo hace ahora el estudiante.`,
      relatedEntityType: "reservations",
      relatedEntityId: reservation.id as string,
    });
  }
  return { ok: true, payerUserId: newPayerUserId };
}

/**
 * Al revocarse el vínculo, los fees que esperan pago y tenían al ex familiar como pagador vuelven al estudiante (DR4):
 * el familiar desvinculado ya no puede pagar ni ver los datos de cobro, y el estudiante no queda sin poder pagar.
 * Nunca lanza (la desvinculación ya se hizo); devuelve cuántos fees se reasignaron.
 */
export async function resetFeePayersOnLinkEnd(
  admin: SupabaseClient,
  params: { studentProfileId: string; studentUserId: string; familyUserId: string },
): Promise<number> {
  const { data, error } = await admin
    .from("estured_fee_payments")
    .update({ payer_user_id: params.studentUserId })
    .eq("beneficiary_student_profile_id", params.studentProfileId)
    .eq("payer_user_id", params.familyUserId)
    .eq("status", "pending_payment_method")
    .select("id");
  if (error) {
    console.error("[family] resetFeePayersOnLinkEnd failed:", error);
    return 0;
  }
  return data?.length ?? 0;
}
