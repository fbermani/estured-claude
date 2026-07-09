import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Crea la fila `external_residence_payments` en estado `pending` al
 * entrar a `residence_payment_pending` (docs/06 §4.6: `pending` es el
 * primer estado real del enum, no una ausencia implícita de fila).
 * Se llama desde los dos caminos que habilitan el pago: sin negociación
 * (`enableResidencePayment`) y al aceptar/mantener condiciones tras una
 * propuesta (`respondNegotiationProposal`).
 */
export async function createPendingResidencePayment(
  admin: SupabaseClient,
  params: { applicationId: string; residenceId: string; studentProfileId: string },
): Promise<void> {
  const { error } = await admin.from("external_residence_payments").insert({
    application_request_id: params.applicationId,
    residence_id: params.residenceId,
    student_profile_id: params.studentProfileId,
    status: "pending",
  });
  if (error) {
    console.error("[residence-payment] no se pudo crear la fila pending:", error);
  }
}
