"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { recordResidencePaymentReceived } from "@/lib/reservations/recordResidencePaymentReceived";

export type MarkReceivedState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Capa fina (docs/07 §16.2) — resuelve sesión, parsea `FormData` y
 * delega toda la lógica de negocio a `recordResidencePaymentReceived`
 * (extraída en el Ciclo 19, GAPS.md, para que sea testeable sin
 * `next/headers`).
 */
export async function markResidencePaymentReceived(
  applicationId: string,
  _prev: MarkReceivedState,
  formData: FormData,
): Promise<MarkReceivedState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const receiptFile = formData.get("receipt_file");

  const result = await recordResidencePaymentReceived(admin, {
    applicationId,
    actorUserId: sessionUser.id,
    receivedAmountArs: Number(formData.get("received_amount_ars") ?? 0) || null,
    receivedAmountUsd: Number(formData.get("received_amount_usd") ?? 0) || null,
    paymentMethodLabel: String(formData.get("payment_method_label") ?? "").trim(),
    confirmationAccepted: formData.get("confirmation_checkbox_accepted") === "on",
    receiptFile: receiptFile instanceof File && receiptFile.size > 0 ? receiptFile : null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${result.residenceId}/applications/${applicationId}`);
  revalidatePath(`/students/applications/${applicationId}`);
  return { status: "saved" };
}
