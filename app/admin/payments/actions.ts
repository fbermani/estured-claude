"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { recordManualFeePayment } from "@/lib/reservations/recordManualFeePayment";

export type MarkFeePaidState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Capa fina (docs/07 §17.4) — resuelve sesión, parsea `FormData` y
 * delega toda la lógica de negocio a `recordManualFeePayment` (extraída
 * en el Ciclo 19, GAPS.md, para que sea testeable sin `next/headers`).
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

  const actorRole = sessionUser.roles.includes("superadmin") ? "superadmin" : "admin";

  const result = await recordManualFeePayment(admin, {
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
