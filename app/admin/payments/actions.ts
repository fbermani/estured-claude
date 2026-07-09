"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { confirmReservationAfterFeePaid } from "@/lib/reservations/confirmAfterFeePaid";

export type MarkFeePaidState = { status: "idle" | "error" | "saved"; message?: string };

const VALIDATABLE_STATUSES = ["pending_payment_method", "pending_manual_payment"];

/**
 * Docs/07 §17.4 — admin valida un pago manual del fee EstuRed. Motivo
 * obligatorio (queda auditado). Dispara la confirmación de reserva +
 * generación de comprobante en la misma operación (docs/07 §18.2).
 */
export async function markFeePaidManually(
  feePaymentId: string,
  _prev: MarkFeePaidState,
  formData: FormData,
): Promise<MarkFeePaidState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "No tenés permiso para esta acción." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { status: "error", message: "Escribí un motivo para que quede registrado." };
  const paymentCurrency = String(formData.get("payment_currency") ?? "ARS");
  if (!["ARS", "USD"].includes(paymentCurrency)) return { status: "error", message: "Moneda inválida." };
  const providerReference = String(formData.get("payment_provider_reference") ?? "").trim() || null;

  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("id, status")
    .eq("id", feePaymentId)
    .maybeSingle();
  if (!feePayment) return { status: "error", message: "No encontramos ese pago." };
  if (!VALIDATABLE_STATUSES.includes(feePayment.status)) {
    return { status: "error", message: "Ese pago ya no está pendiente de validación." };
  }

  const actorRole = sessionUser.roles.includes("superadmin") ? "superadmin" : "admin";
  const now = new Date();

  const { error: updateError } = await admin
    .from("estured_fee_payments")
    .update({
      status: "paid",
      payment_provider: "manual",
      payment_currency: paymentCurrency,
      provider_payment_id: providerReference,
      paid_at: now.toISOString(),
    })
    .eq("id", feePaymentId);
  if (updateError) {
    console.error("[admin-payments] mark-paid failed:", updateError);
    return { status: "error", message: "No pudimos guardar el pago." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole,
    action: "estured_fee_marked_paid_manually",
    entityType: "estured_fee_payments",
    entityId: feePaymentId,
    reasonText: reason,
    source: "admin",
  });

  const result = await confirmReservationAfterFeePaid(admin, {
    feePaymentId,
    actorUserId: sessionUser.id,
    actorRole,
  });
  if (!result.ok) {
    console.error("[admin-payments] confirmReservationAfterFeePaid failed:", result.error);
    return { status: "error", message: `Pago marcado, pero falló la confirmación de la reserva: ${result.error}` };
  }

  revalidatePath("/admin/payments");
  return { status: "saved" };
}
