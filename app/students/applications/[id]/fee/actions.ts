"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { registerManualFeePaymentCore } from "@/lib/payments/registerFeePayment";

export type RegisterFeePaymentState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * «Ya pagué» del fee (docs/07 §17.3, DR64 (c)). Capa fina: resuelve la sesión y delega todo en `registerManualFeePaymentCore`, que
 * valida en el servidor quién es el pagador, el medio elegido, el plazo y el comprobante obligatorio. NUNCA confirma la reserva por sí
 * solo: queda pendiente de validación del admin (§17.4).
 */
export async function registerManualFeePayment(
  applicationId: string,
  _prev: RegisterFeePaymentState,
  formData: FormData,
): Promise<RegisterFeePaymentState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await registerManualFeePaymentCore(admin, { actorUserId: sessionUser.id, applicationId, formData });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/applications/${applicationId}/fee`);
  return { status: "saved" };
}
