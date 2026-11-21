import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Lo que se congela en la fila de pago con el camino «Cobro con medios habilitados» (DR63 (d)). */
export type FrozenPaymentColumns = {
  chosen_method: string;
  expected_amount_usd: number;
  expected_amount_ars: number;
  /** Texto con los datos de cobro APROBADOS. Sin SELECT para anon/authenticated (0102): solo service role. */
  instructions_snapshot: string;
};

/**
 * Crea la fila `external_residence_payments` en estado `pending` al
 * entrar a `residence_payment_pending` (docs/06 §4.6: `pending` es el
 * primer estado real del enum, no una ausencia implícita de fila).
 * Se llama desde los dos caminos que habilitan el pago: sin negociación
 * (`enableResidencePayment`) y al aceptar/mantener condiciones tras una
 * propuesta (`respondNegotiationProposal`).
 *
 * `collection` (DR63): con «Cobro con medios habilitados» la fila nace con el medio, el monto y las instrucciones ya congelados.
 * Devuelve `false` si el insert falló, para que quien habilita el pago no deje la solicitud en `residence_payment_pending` sin esos datos.
 */
export async function createPendingResidencePayment(
  admin: SupabaseClient,
  params: { applicationId: string; residenceId: string; studentProfileId: string; collection?: FrozenPaymentColumns | null },
): Promise<boolean> {
  const { error } = await admin.from("external_residence_payments").insert({
    application_request_id: params.applicationId,
    residence_id: params.residenceId,
    student_profile_id: params.studentProfileId,
    status: "pending",
    ...(params.collection ?? {}),
  });
  if (error) {
    console.error("[residence-payment] no se pudo crear la fila pending:", error);
    return false;
  }
  return true;
}
