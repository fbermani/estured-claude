"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import {
  disputeReportedResidencePaymentCore,
  openStudentPaymentProofCore,
  resolveStudentPaymentIssueCore,
} from "@/lib/applications/residencePaymentReview";

export type PaymentReviewState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Capa fina (DR63, docs/07 §16.7, §16.9 y §16.10): resuelve la sesión y delega en `residencePaymentReview`, que valida permiso
 * (`payments.residence`), rol y estado EN EL SERVIDOR. `revalidatePath` de la bandeja y del detalle del estudiante.
 */
async function context() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { ok: false, error: "Tu sesión expiró. Volvé a ingresar." } as const;
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "No disponible en este momento." } as const;
  return { ok: true, sessionUser, admin } as const;
}

async function revalidate(applicationId: string) {
  revalidatePath("/residence/[residence_id]/applications", "page");
  revalidatePath(`/students/applications/${applicationId}`);
}

/** «No recibí el pago»: motivo de al menos 10 caracteres y confirmación del alcance de Soporte. */
export async function disputeReportedPayment(applicationId: string, _prev: PaymentReviewState, formData: FormData): Promise<PaymentReviewState> {
  const ctx = await context();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  const result = await disputeReportedResidencePaymentCore(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    applicationId,
    reason: formData.get("reason"),
    termsAccepted: formData.get("terms_accepted") === "on",
  });
  if (!result.ok) return { status: "error", message: result.error };
  await revalidate(applicationId);
  return { status: "saved" };
}

/** Responde «No pude realizar el pago»: `resolution` = `contact_whatsapp` | `reenable_payment` (con `chosen_method` opcional). */
export async function resolveStudentPaymentIssue(applicationId: string, _prev: PaymentReviewState, formData: FormData): Promise<PaymentReviewState> {
  const ctx = await context();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  const chosen = formData.get("chosen_method");
  const result = await resolveStudentPaymentIssueCore(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    applicationId,
    resolution: formData.get("resolution"),
    chosenMethod: typeof chosen === "string" && chosen !== "" ? chosen : undefined,
  });
  if (!result.ok) return { status: "error", message: result.error };
  await revalidate(applicationId);
  return { status: "saved" };
}

/** Link firmado corto al comprobante del estudiante. Recibe SOLO el id de la solicitud: el archivo sale del pago en el servidor. */
export async function openStudentPaymentProof(applicationId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await context();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  return openStudentPaymentProofCore(ctx.admin, { actorUserId: ctx.sessionUser.id, applicationId });
}
