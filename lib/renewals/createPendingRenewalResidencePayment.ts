import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Crea la fila `external_residence_payments` en estado `pending` al
 * aceptar una oferta de renovación — mismo patrón que
 * `lib/applications/residencePayment.ts` (`createPendingResidencePayment`)
 * para la reserva inicial, pero vinculada por `renewal_offer_id` en vez
 * de `application_request_id` (migración 0017).
 */
export async function createPendingRenewalResidencePayment(
  admin: SupabaseClient,
  params: { renewalOfferId: string; residenceId: string; studentProfileId: string; reservationId: string },
): Promise<void> {
  const { error } = await admin.from("external_residence_payments").insert({
    renewal_offer_id: params.renewalOfferId,
    reservation_id: params.reservationId,
    residence_id: params.residenceId,
    student_profile_id: params.studentProfileId,
    status: "pending",
  });
  if (error) {
    console.error("[renewals] no se pudo crear la fila pending de pago a residencia:", error);
  }
}
