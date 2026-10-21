import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONFIRMED_RENEWAL_STATUSES,
  daysUntilDate,
  resolveContractEnd,
  resolveStayRate,
  type ContractEnd,
  type RenewalPeriod,
  type StayRate,
} from "@/lib/students/contractEnd";

export type StudentContract = ContractEnd &
  StayRate & {
    reservationId: string;
    /** Días hasta el fin de contrato vigente (≤ 0 = vencido). */
    daysRemaining: number;
  };

export type ContractReservationInput = {
  id: string;
  start_date: string;
  initial_duration_months: number;
  /** Tarifa del snapshot aceptado en la reserva (`application_snapshots.monthly_price_usd`). */
  snapshotRateUsd: number | null;
};

/**
 * Arma el "contrato vigente" de cada reserva confirmada del estudiante
 * (H05): estadía vinculada → última renovación confirmada → reserva. Usa
 * el cliente del USUARIO: las RLS `resident_stays_select_student` y
 * `renewal_offers_select_student` ya limitan a lo propio. Ante un error de
 * lectura degrada a "solo la reserva" en vez de romper la pantalla.
 */
export async function loadStudentContracts(
  supabase: SupabaseClient,
  reservations: ContractReservationInput[],
  now: Date = new Date(),
): Promise<Map<string, StudentContract>> {
  const result = new Map<string, StudentContract>();
  if (reservations.length === 0) return result;
  const ids = reservations.map((r) => r.id);

  const [{ data: stays, error: staysError }, { data: offers, error: offersError }] = await Promise.all([
    supabase
      .from("resident_stays")
      .select("reservation_id, expected_end_date, monthly_rate_usd")
      .in("reservation_id", ids)
      .eq("is_current", true),
    supabase
      .from("renewal_offers")
      .select("reservation_id, status, period_end_date")
      .in("reservation_id", ids)
      .in("status", [...CONFIRMED_RENEWAL_STATUSES]),
  ]);
  if (staysError) console.error("[loadStudentContracts] resident_stays query failed:", staysError);
  if (offersError) console.error("[loadStudentContracts] renewal_offers query failed:", offersError);

  const stayByReservation = new Map<string, { expected_end_date: string | null; monthly_rate_usd: number | null }>();
  for (const s of stays ?? []) {
    if (s.reservation_id && !stayByReservation.has(s.reservation_id as string)) {
      stayByReservation.set(s.reservation_id as string, s as { expected_end_date: string | null; monthly_rate_usd: number | null });
    }
  }
  const renewalsByReservation = new Map<string, RenewalPeriod[]>();
  for (const o of offers ?? []) {
    const list = renewalsByReservation.get(o.reservation_id as string) ?? [];
    list.push({ status: o.status as string, periodEndDate: (o.period_end_date as string | null) ?? null });
    renewalsByReservation.set(o.reservation_id as string, list);
  }

  for (const r of reservations) {
    const stay = stayByReservation.get(r.id);
    const end = resolveContractEnd({
      startDate: r.start_date,
      initialDurationMonths: r.initial_duration_months,
      stayExpectedEndDate: stay?.expected_end_date ?? null,
      renewals: renewalsByReservation.get(r.id) ?? [],
    });
    const rate = resolveStayRate({
      snapshotRateUsd: r.snapshotRateUsd,
      stayRateUsd: stay?.monthly_rate_usd != null ? Number(stay.monthly_rate_usd) : null,
    });
    result.set(r.id, { ...end, ...rate, reservationId: r.id, daysRemaining: daysUntilDate(end.endDate, now) });
  }
  return result;
}
