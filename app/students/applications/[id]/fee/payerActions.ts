"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { setFeePayer } from "@/lib/family/setFeePayer";
import { chooseFeePaymentMethodCore, reportFeePaymentIssueCore } from "@/lib/payments/feePayerActions";

export type DesignatePayerState = { status: "idle" | "error" | "saved"; message?: string };

/** El estudiante designa quién paga el fee: él mismo o su familiar vinculado (DR4). Valida todo server-side en `setFeePayer`. */
export async function designateFeePayer(
  applicationId: string,
  payer: "self" | "family",
  _prev: DesignatePayerState,
): Promise<DesignatePayerState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setFeePayer(admin, { actorUserId: sessionUser.id, applicationId, payer });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/applications/${applicationId}/fee`);
  return { status: "saved" };
}

export type FeeMethodState = { status: "idle" | "error" | "saved"; message?: string };

/** El pagador elige (o cambia) el medio de pago del fee (docs/07 §17.7, DR64 (b)). Toda la validación vive en `chooseFeePaymentMethodCore`. */
export async function chooseFeePaymentMethod(
  applicationId: string,
  _prev: FeeMethodState,
  formData: FormData,
): Promise<FeeMethodState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await chooseFeePaymentMethodCore(admin, {
    actorUserId: sessionUser.id,
    applicationId,
    methodKey: formData.get("method_key"),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/applications/${applicationId}/fee`);
  return { status: "saved" };
}

/** «No pude realizar el pago» del fee (docs/07 §17.8, DR64 (e)). Motivo opcional; se valida en el servidor. */
export async function reportFeePaymentIssue(
  applicationId: string,
  _prev: FeeMethodState,
  formData: FormData,
): Promise<FeeMethodState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reportFeePaymentIssueCore(admin, {
    actorUserId: sessionUser.id,
    applicationId,
    reason: formData.get("reason"),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/applications/${applicationId}/fee`);
  return { status: "saved" };
}
