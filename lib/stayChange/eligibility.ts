import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonthsIso } from "@/lib/students/contractEnd";
import { loadStudentContracts } from "@/lib/students/loadStudentContracts";

/**
 * ¿Puede este estudiante avisar que busca un cambio? (`docs/04` §12bis.3 y §12bis.4, `docs/08` §6.16).
 *
 * Requisitos: reserva vigente `confirmed`/`receipt_pending`/`receipt_issued` o estadía `pending_activation`/`active`
 * (incluye `visibility_limited`/`hidden_by_user`) sin salida real; y SIN una renovación aceptada con pago/fee en curso
 * (primero se resuelve la renovación). Una reserva en `pending_estured_fee` no alcanza (GAPS #9, supuesto).
 */

export const ELIGIBLE_RESERVATION_STATUSES = ["confirmed", "receipt_pending", "receipt_issued"] as const;
const ELIGIBLE_STAY_STATUSES = ["pending_activation", "active", "visibility_limited", "hidden_by_user"] as const;
/** Renovaciones aceptadas cuyo pago/fee todavía no terminó: bloquean el aviso. */
export const RENEWAL_IN_PROGRESS_STATUSES = [
  "accepted_by_student",
  "residence_payment_pending",
  "residence_payment_reported",
  "estured_fee_pending",
  "estured_fee_processing",
] as const;

export type StayChangeContext = {
  currentResidenceId: string;
  currentResidenceName: string;
  reservationId: string | null;
  residentStayId: string | null;
  /** Ingreso ("YYYY-MM-DD"), si se conoce. */
  startDate: string | null;
  /** Fin de contrato vigente ("YYYY-MM-DD"), si se conoce. */
  contractEndDate: string | null;
};

export type StayChangeEligibility =
  | { ok: true; context: StayChangeContext }
  | { ok: false; reason: "no_stay" | "renewal_in_progress" | "read_failed"; error: string };

export async function loadStayChangeEligibility(
  admin: SupabaseClient,
  studentProfileId: string,
  now: Date = new Date(),
): Promise<StayChangeEligibility> {
  const readFailed: StayChangeEligibility = {
    ok: false,
    reason: "read_failed",
    error: "No pudimos verificar tu estadía. Intentá de nuevo en unos minutos.",
  };

  const [stayRes, reservationRes, renewalRes] = await Promise.all([
    admin
      .from("resident_stays")
      .select("id, residence_id, reservation_id, start_date, expected_end_date, residences(name)")
      .eq("student_profile_id", studentProfileId)
      .eq("is_current", true)
      .in("status", [...ELIGIBLE_STAY_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("reservations")
      .select("id, residence_id, start_date, initial_duration_months, residences(name)")
      .eq("student_profile_id", studentProfileId)
      .in("status", [...ELIGIBLE_RESERVATION_STATUSES])
      .order("start_date", { ascending: false }),
    admin
      .from("renewal_offers")
      .select("id", { count: "exact", head: true })
      .eq("student_profile_id", studentProfileId)
      .in("status", [...RENEWAL_IN_PROGRESS_STATUSES]),
  ]);
  if (stayRes.error || reservationRes.error || renewalRes.error) {
    console.error("[stayChange] eligibility read failed:", stayRes.error ?? reservationRes.error ?? renewalRes.error);
    return readFailed;
  }
  if ((renewalRes.count ?? 0) > 0) {
    return { ok: false, reason: "renewal_in_progress", error: "Primero resolvé tu renovación. Después vas a poder avisar que buscás un cambio." };
  }

  type StayRow = { id: string; residence_id: string; reservation_id: string | null; start_date: string | null; expected_end_date: string | null; residences: { name: string } | null };
  type ResRow = { id: string; residence_id: string; start_date: string; initial_duration_months: number; residences: { name: string } | null };
  const stay = stayRes.data as unknown as StayRow | null;
  const reservations = (reservationRes.data ?? []) as unknown as ResRow[];

  // Reservas cuya estadía ya terminó no cuentan.
  let liveReservations = reservations;
  if (reservations.length) {
    const { data: ended, error: endedError } = await admin
      .from("resident_stays")
      .select("reservation_id")
      .in("reservation_id", reservations.map((r) => r.id))
      .eq("status", "inactive");
    if (endedError) {
      console.error("[stayChange] eligibility ended stays read failed:", endedError);
      return readFailed;
    }
    const endedIds = new Set((ended ?? []).map((s) => s.reservation_id as string));
    liveReservations = reservations.filter((r) => !endedIds.has(r.id));
  }

  const reservation = stay?.reservation_id
    ? (liveReservations.find((r) => r.id === stay.reservation_id) ?? null)
    : (liveReservations[0] ?? null);
  if (!stay && !reservation) {
    return { ok: false, reason: "no_stay", error: "Todavía no tenés una reserva vigente ni una estadía en curso para avisar un cambio." };
  }

  let contractEndDate: string | null = stay?.expected_end_date ?? null;
  if (!contractEndDate && reservation) {
    const contracts = await loadStudentContracts(
      admin,
      [{ id: reservation.id, start_date: reservation.start_date, initial_duration_months: Number(reservation.initial_duration_months), snapshotRateUsd: null }],
      now,
    );
    contractEndDate =
      contracts.get(reservation.id)?.endDate ?? addMonthsIso(reservation.start_date, Number(reservation.initial_duration_months));
  }

  const residenceId = stay?.residence_id ?? reservation!.residence_id;
  const residenceName = (stay?.residences ?? reservation?.residences)?.name ?? "tu residencia";
  return {
    ok: true,
    context: {
      currentResidenceId: residenceId,
      currentResidenceName: residenceName,
      reservationId: reservation?.id ?? stay?.reservation_id ?? null,
      residentStayId: stay?.id ?? null,
      startDate: stay?.start_date ?? reservation?.start_date ?? null,
      contractEndDate,
    },
  };
}
