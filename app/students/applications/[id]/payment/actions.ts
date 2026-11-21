"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { reportResidencePaymentIssueCore, reportResidencePaymentPaidCore } from "@/lib/applications/studentPaymentReport";

export type ReportPaymentState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * «Ya pagué» (DR63 (e), docs/07 §16.4). Capa fina: resuelve la sesión, toma el comprobante OPCIONAL del `FormData` y delega todo en
 * `reportResidencePaymentPaidCore` (que valida en el servidor quién es el actor y el estado). Nunca confirma la reserva: solo la
 * residencia lo hace con «Pago recibido».
 */
export async function reportResidencePaymentPaid(
  applicationId: string,
  _prev: ReportPaymentState,
  formData: FormData,
): Promise<ReportPaymentState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a ingresar." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reportResidencePaymentPaidCore(admin, {
    actorUserId: sessionUser.id,
    applicationId,
    proofInput: formData.get("proof_file"),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/students/applications/${applicationId}`);
  return { status: "saved" };
}

/** «No pude realizar el pago» (DR63 (l), docs/07 §16.9). Motivo opcional; se valida en el servidor. */
export async function reportResidencePaymentIssue(
  applicationId: string,
  _prev: ReportPaymentState,
  formData: FormData,
): Promise<ReportPaymentState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a ingresar." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reportResidencePaymentIssueCore(admin, {
    actorUserId: sessionUser.id,
    applicationId,
    reason: formData.get("reason"),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/students/applications/${applicationId}`);
  return { status: "saved" };
}
