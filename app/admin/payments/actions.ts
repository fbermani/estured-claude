"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { recordManualFeePayment } from "@/lib/reservations/recordManualFeePayment";
import { retryReservationConfirmation } from "@/lib/reservations/retryReservationConfirmation";
import { recordRenewalManualFeePayment } from "@/lib/renewals/recordRenewalManualFeePayment";
import { disputeFeePaymentCore, resolveFeePaymentIssueCore } from "@/lib/payments/feeAdminActions";
import { reopenEsturedFeeWindow } from "@/lib/reservations/reopenEsturedFeeWindow";
import { adminActorRole, getAdminSession } from "@/lib/auth/requireAdmin";

export type MarkFeePaidState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Capa fina (docs/07 §17.4) — resuelve sesión, parsea `FormData` y
 * delega toda la lógica de negocio a `recordManualFeePayment` (extraída
 * en el Ciclo 19, GAPS.md, para que sea testeable sin `next/headers`).
 *
 * DR8 (Ciclo 71): el intent llega en el `name`/`value` nativo del botón
 * ("confirm" con comprobante / "confirm_without_receipt" override), junto con el
 * monto recibido y los checkboxes de confirmación. Toda la validación es server-side.
 */
export async function markFeePaidManually(
  feePaymentId: string,
  _prev: MarkFeePaidState,
  formData: FormData,
): Promise<MarkFeePaidState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "No tenés permiso para esta acción." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await recordManualFeePayment(admin, {
    feePaymentId,
    reason: String(formData.get("reason") ?? "").trim(),
    paymentCurrency: String(formData.get("payment_currency") ?? ""),
    receivedAmount: String(formData.get("received_amount") ?? ""),
    providerReference: String(formData.get("payment_provider_reference") ?? "").trim().slice(0, 120) || null,
    intent: String(formData.get("intent") ?? ""),
    confirmWithoutReceipt: formData.get("confirm_without_receipt") === "on",
    verified: formData.get("verified") === "on",
    acceptAmountDifference: formData.get("accept_amount_difference") === "on",
    seenReceiptFileId: String(formData.get("receipt_file_id") ?? "").trim() || null,
    actorUserId: sessionUser.id,
    actorRole: adminActorRole(sessionUser),
  });
  // También ante un error: puede haber quedado el fee `paid` con la reserva sin confirmar, y la pantalla tiene que reflejarlo.
  revalidatePath("/admin/payments");
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "saved" };
}

/**
 * Ciclo 71 (DR8) — "Reintentar confirmación": fee `paid` con la reserva todavía en `pending_estured_fee`. Mismo rol y sesión que
 * `markFeePaidManually`; delega a `retryReservationConfirmation` (idempotente, con auditoría).
 */
export async function retryReservationConfirmationAction(feePaymentId: string): Promise<MarkFeePaidState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "No tenés permiso para esta acción." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await retryReservationConfirmation(admin, {
    feePaymentId,
    actorUserId: sessionUser.id,
    actorRole: adminActorRole(sessionUser),
  });
  revalidatePath("/admin/payments");
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "saved" };
}

/**
 * Igual que `markFeePaidManually`, pero para el fee de una renovación
 * (`estured_fee_payments.renewal_offer_id` en vez de `reservation_id`)
 * — delega a `recordRenewalManualFeePayment`.
 */
export async function markRenewalFeePaidManually(
  feePaymentId: string,
  _prev: MarkFeePaidState,
  formData: FormData,
): Promise<MarkFeePaidState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "No tenés permiso para esta acción." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const actorRole = sessionUser.roles.includes("superadmin") ? "superadmin" : "admin";

  const result = await recordRenewalManualFeePayment(admin, {
    feePaymentId,
    reason: String(formData.get("reason") ?? "").trim(),
    paymentCurrency: String(formData.get("payment_currency") ?? "ARS"),
    providerReference: String(formData.get("payment_provider_reference") ?? "").trim() || null,
    actorUserId: sessionUser.id,
    actorRole,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/admin/payments");
  return { status: "saved" };
}

/**
 * DR64 (d) — «No recibí el pago». Capa fina: sesión admin/superadmin, parseo de `FormData` y delegación a `disputeFeePaymentCore`. El
 * estado del fee y de la reserva no cambia; abre un caso de Soporte y avisa al pagador (sin el motivo).
 */
export async function disputeFeePaymentAction(feePaymentId: string, _prev: MarkFeePaidState, formData: FormData): Promise<MarkFeePaidState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "No tenés permiso para esta acción." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await disputeFeePaymentCore(admin, {
    feePaymentId,
    reason: String(formData.get("reason") ?? ""),
    seenReceiptFileId: String(formData.get("receipt_file_id") ?? "").trim() || null,
    actorUserId: sessionUser.id,
    actorRole: adminActorRole(sessionUser),
  });
  revalidatePath("/admin/payments");
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "saved", message: "Registramos que no recibiste el pago. Se abrió un caso de Soporte y se avisó al pagador." };
}

/**
 * DR64 (e) — responde «No pude realizar el pago». La opción llega en el `name`/`value` nativo del botón (`contact_payer` o
 * `reopen_payment`). Ambas reinician el plazo de 48 h.
 */
export async function resolveFeeIssueAction(feePaymentId: string, _prev: MarkFeePaidState, formData: FormData): Promise<MarkFeePaidState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "No tenés permiso para esta acción." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await resolveFeePaymentIssueCore(admin, {
    feePaymentId,
    resolution: formData.get("resolution"),
    reason: String(formData.get("reason") ?? ""),
    actorUserId: sessionUser.id,
    actorRole: adminActorRole(sessionUser),
  });
  revalidatePath("/admin/payments");
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "saved", message: "Respondiste el aviso. El pagador tiene 48 horas más." };
}

/** DR64 (d) — «Reabrir el pago» tras «No recibí el pago»: el pagador elige medio y sube otro comprobante (48 h). */
export async function reopenFeePaymentAction(feePaymentId: string, _prev: MarkFeePaidState, formData: FormData): Promise<MarkFeePaidState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "No tenés permiso para esta acción." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reopenEsturedFeeWindow(admin, {
    feePaymentId,
    actorUserId: sessionUser.id,
    actorRole: adminActorRole(sessionUser),
    reason: String(formData.get("reason") ?? ""),
  });
  revalidatePath("/admin/payments");
  if (result.status === "error") return { status: "error", message: result.message };
  return { status: "saved", message: "Reabriste el pago. El pagador tiene 48 horas para elegir el medio y subir otro comprobante." };
}
