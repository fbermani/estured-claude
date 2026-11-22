import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveFamilyLink } from "@/lib/family/access";

/**
 * Quién puede elegir el medio, informar el pago o avisar «No pude realizar el pago» del fee de UNA reserva (DR64 (b), `docs/07` §17.7).
 * Todo se deriva de la BASE, nunca de roles de sesión ni de lo que mande el cliente:
 *  - el pagador designado del fee (`estured_fee_payments.payer_user_id`, DR4) tiene que ser quien actúa;
 *  - y tiene que ser el estudiante de la solicitud, o su familiar vinculado ACTIVO con `can_pay_estured_fee` (revalidado en cada llamada).
 * No usa `resolvePaymentActor` (pago a la residencia): ese solo admite al familiar de un MENOR y no mira `payer_user_id`, y el fee admite
 * un familiar pagador también para un adulto (DR4). El staff de la residencia, otros estudiantes y el beneficiario cuyo fee paga otra
 * persona no son actores.
 */

export type FeePayerRole = "student" | "family_member";

/** Columnas del fee que necesitan las acciones del pagador. Nunca incluye `instructions_snapshot` (se lee aparte, solo cuando corresponde). */
export const FEE_PAYER_COLUMNS =
  "id, status, payer_user_id, expires_at, chosen_method, payment_currency, fee_amount_ars, fee_amount_usd, fee_base_usd, fee_base_ars, student_reported_paid_at, student_payment_issue_at, student_payment_issue_resolved_at";

export type FeePayerFee = {
  id: string;
  status: string;
  payer_user_id: string;
  expires_at: string | null;
  chosen_method: string | null;
  payment_currency: string | null;
  fee_amount_ars: number | string | null;
  fee_amount_usd: number | string | null;
  fee_base_usd: number | string | null;
  fee_base_ars: number | string | null;
  student_reported_paid_at: string | null;
  student_payment_issue_at: string | null;
  student_payment_issue_resolved_at: string | null;
};

export type FeePayerResolution =
  | {
      ok: true;
      role: FeePayerRole;
      application: { id: string; residence_id: string; student_profile_id: string };
      reservation: { id: string };
      fee: FeePayerFee;
    }
  | { ok: false; error: string };

export const FEE_NOT_FOUND = "No encontramos esa solicitud.";
export const FEE_READ_FAILED = "No pudimos verificar el pago. Probá de nuevo en unos minutos.";
export const FEE_NOT_PAYER = "El pago lo hace quien está designado como pagador de esta reserva.";

export async function resolveFeePayer(admin: SupabaseClient, userId: string, applicationId: string): Promise<FeePayerResolution> {
  if (!userId) return { ok: false, error: FEE_NOT_FOUND };
  const { data: application, error: appError } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (appError) {
    console.error("[fee-payer] application read failed:", appError.code, appError.message);
    return { ok: false, error: FEE_READ_FAILED };
  }
  if (!application) return { ok: false, error: FEE_NOT_FOUND };

  const { data: profile, error: profileError } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", application.student_profile_id as string)
    .maybeSingle();
  if (profileError) {
    console.error("[fee-payer] student profile read failed:", profileError.code, profileError.message);
    return { ok: false, error: FEE_READ_FAILED };
  }
  const studentUserId = (profile?.user_id as string | undefined) ?? null;

  let role: FeePayerRole;
  if (studentUserId && studentUserId === userId) {
    role = "student";
  } else {
    // Familiar: se revalida EN EL MOMENTO el vínculo activo y el permiso (pudo revocarse después de designarlo).
    const link = await loadActiveFamilyLink(admin, userId, application.student_profile_id as string);
    if (!link) return { ok: false, error: FEE_NOT_FOUND };
    if (link.permissions.can_pay_estured_fee !== true) return { ok: false, error: "Ya no tenés permitido pagar el fee de esta reserva." };
    role = "family_member";
  }

  if (application.status !== "converted_to_reservation") {
    return { ok: false, error: "Todavía no se habilitó el pago del fee para esta solicitud." };
  }
  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id, status, estured_fee_payment_id")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (reservationError) {
    console.error("[fee-payer] reservation read failed:", reservationError.code, reservationError.message);
    return { ok: false, error: FEE_READ_FAILED };
  }
  if (!reservation?.estured_fee_payment_id) return { ok: false, error: "No encontramos el fee de esta reserva." };
  if (reservation.status !== "pending_estured_fee") return { ok: false, error: "El fee de esta reserva ya no está pendiente." };

  const { data: fee, error: feeError } = await admin
    .from("estured_fee_payments")
    .select(FEE_PAYER_COLUMNS)
    .eq("id", reservation.estured_fee_payment_id as string)
    .maybeSingle();
  if (feeError) {
    console.error("[fee-payer] fee read failed:", feeError.code, feeError.message);
    return { ok: false, error: FEE_READ_FAILED };
  }
  if (!fee) return { ok: false, error: "No encontramos el fee de esta reserva." };
  if ((fee as FeePayerFee).payer_user_id !== userId) return { ok: false, error: FEE_NOT_PAYER };

  return {
    ok: true,
    role,
    application: {
      id: application.id as string,
      residence_id: application.residence_id as string,
      student_profile_id: application.student_profile_id as string,
    },
    reservation: { id: reservation.id as string },
    fee: fee as FeePayerFee,
  };
}
