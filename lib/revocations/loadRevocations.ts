import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { isRevocationPending } from "@/lib/revocations/evaluateResolution";
import { computeRevocationWindow, pendingAgeDays, type RevocationWindow } from "@/lib/revocations/window";

/**
 * Lectura de las revocaciones del fee para el panel admin y el contador del dashboard (DR6, docs/09 §35). Siempre con service role.
 * Degrada con gracia si la migración 0049 no está aplicada: vuelve a leer sin las columnas de la resolución y avisa con
 * `migrationApplied = false` (todas las revocaciones salen como pendientes, el panel se ve en modo lectura).
 */

/** `other` = fee en un estado que no es `paid` ni `refunded` (p. ej. `chargeback`): no cuenta como pendiente. */
export type RevocationState = "pending" | "refunded" | "denied" | "other";

export type RevocationRecord = {
  reservationId: string;
  feeId: string | null;
  revokedAt: string | null;
  paidAt: string | null;
  studentName: { firstName: string; lastInitial: string } | null;
  requestedBy: "student" | "family_member" | null;
  studentReason: string | null;
  residenceName: string | null;
  residenceArea: string | null;
  feeStatus: string;
  /** `ARS` | `USD`: moneda en que se pagó el fee (el reintegro se registra siempre en ARS). */
  paymentCurrency: string | null;
  feeAmountArs: number;
  /** Referencia en USD: el valor guardado o, si falta, base × porcentaje. */
  feeAmountUsd: number | null;
  window: RevocationWindow | null;
  state: RevocationState;
  supportCaseId: string | null;
  resolvedAt: string | null;
  internalReason: string | null;
  studentMessage: string | null;
  refundedAt: string | null;
  refundAmountArs: number | null;
  refundMethod: string | null;
  refundReference: string | null;
};

export type RevocationsLoad = {
  records: RevocationRecord[];
  migrationApplied: boolean;
  /** `true` si no se pudo leer la lista (error distinto de "migración pendiente"). */
  loadFailed: boolean;
};

const FEE_BASE = "id, status, paid_at, payment_currency, fee_amount_ars, fee_amount_usd, fee_base_usd, fee_rate_percent, refunded_at";
const FEE_0049 =
  ", revocation_resolution, revocation_resolved_at, revocation_internal_reason, revocation_student_message, refund_amount_ars, refund_method, refund_reference";

type FeeRow = {
  id: string;
  status: string;
  paid_at: string | null;
  payment_currency: string | null;
  fee_amount_ars: number | string;
  fee_amount_usd: number | string | null;
  fee_base_usd: number | string | null;
  fee_rate_percent: number | string | null;
  refunded_at: string | null;
  revocation_resolution?: string | null;
  revocation_resolved_at?: string | null;
  revocation_internal_reason?: string | null;
  revocation_student_message?: string | null;
  refund_amount_ars?: number | string | null;
  refund_method?: string | null;
  refund_reference?: string | null;
};

type ReservationRow = {
  id: string;
  cancelled_at: string | null;
  residences: { name: string; public_area: string } | null;
  student_profiles: { first_name: string; last_initial: string } | null;
  // Hint de FK explícito: reservations ↔ estured_fee_payments tiene 2 FKs (una en cada dirección).
  estured_fee_payments: FeeRow | null;
};

function usdReference(fee: FeeRow): number | null {
  if (fee.fee_amount_usd !== null && fee.fee_amount_usd !== undefined) return Number(fee.fee_amount_usd);
  if (fee.fee_base_usd === null || fee.fee_base_usd === undefined) return null;
  const rate = fee.fee_rate_percent === null || fee.fee_rate_percent === undefined ? 5 : Number(fee.fee_rate_percent);
  return Math.round(Number(fee.fee_base_usd) * rate) / 100;
}

export function deriveRevocationState(fee: Pick<FeeRow, "status" | "revocation_resolution">): RevocationState {
  if (fee.revocation_resolution === "denied") return "denied";
  if (fee.revocation_resolution === "refunded" || fee.status === "refunded") return "refunded";
  // Mismo criterio que la acción de resolver: solo un fee `paid` sin resolución es pendiente (esta consulta ya filtra reservas revocadas).
  const pending = isRevocationPending({
    reservationStatus: "cancelled_by_student",
    cancellationReasonCode: "student_revocation_right",
    feeStatus: fee.status,
    revocationResolution: fee.revocation_resolution ?? null,
  });
  return pending ? "pending" : "other";
}

async function fetchReservations(admin: SupabaseClient, withResolution: boolean) {
  return admin
    .from("reservations")
    .select(
      `id, cancelled_at, residences (name, public_area), student_profiles (first_name, last_initial), estured_fee_payments!reservations_estured_fee_payment_fk (${FEE_BASE}${withResolution ? FEE_0049 : ""})`,
    )
    .eq("status", "cancelled_by_student")
    .eq("cancellation_reason_code", "student_revocation_right")
    .order("cancelled_at", { ascending: false });
}

export async function loadRevocationRecords(admin: SupabaseClient): Promise<RevocationsLoad> {
  let migrationApplied = true;
  let result = await fetchReservations(admin, true);
  if (result.error && isMissingSchemaError(result.error)) {
    migrationApplied = false;
    result = await fetchReservations(admin, false);
  }
  if (result.error) {
    console.error("[admin-revocations] reservations query failed:", result.error);
    return { records: [], migrationApplied, loadFailed: true };
  }
  const rows = (result.data ?? []) as unknown as ReservationRow[];
  const reservationIds = rows.map((r) => r.id);

  const logs = new Map<string, { actor_role: string; reason_text: string | null }>();
  const cases = new Map<string, string>();
  if (reservationIds.length > 0) {
    const logsResult = await admin
      .from("audit_logs")
      .select("entity_id, actor_role, reason_text")
      .eq("action", "estured_fee_revoked")
      .eq("entity_type", "reservations")
      .in("entity_id", reservationIds);
    if (logsResult.error) console.error("[admin-revocations] audit_logs query failed:", logsResult.error);
    for (const log of logsResult.data ?? []) logs.set(log.entity_id as string, log);

    // Caso de Soporte `fee_revocation` (migración 0049): opcional, nunca rompe la lista.
    const casesResult = await admin
      .from("support_cases")
      .select("id, related_entity_id")
      .eq("topic", "fee_revocation")
      .in("related_entity_id", reservationIds);
    if (casesResult.error) {
      if (!isMissingSchemaError(casesResult.error)) console.error("[admin-revocations] support_cases query failed:", casesResult.error);
    } else {
      for (const c of casesResult.data ?? []) cases.set(c.related_entity_id as string, c.id as string);
    }
  }

  const records: RevocationRecord[] = rows.map((r) => {
    const fee = r.estured_fee_payments;
    const log = logs.get(r.id);
    const paidAt = fee?.paid_at ?? null;
    return {
      reservationId: r.id,
      feeId: fee?.id ?? null,
      revokedAt: r.cancelled_at,
      paidAt,
      studentName: r.student_profiles ? { firstName: r.student_profiles.first_name, lastInitial: r.student_profiles.last_initial } : null,
      requestedBy: log ? (log.actor_role === "family_member" ? "family_member" : "student") : null,
      studentReason: log?.reason_text ?? null,
      residenceName: r.residences?.name ?? null,
      residenceArea: r.residences?.public_area ?? null,
      feeStatus: fee?.status ?? "paid",
      paymentCurrency: fee?.payment_currency ?? null,
      feeAmountArs: fee ? Number(fee.fee_amount_ars) : 0,
      feeAmountUsd: fee ? usdReference(fee) : null,
      window: paidAt && r.cancelled_at ? computeRevocationWindow(paidAt, r.cancelled_at) : null,
      state: fee ? deriveRevocationState(fee) : "pending",
      supportCaseId: cases.get(r.id) ?? null,
      resolvedAt: fee?.revocation_resolved_at ?? null,
      internalReason: fee?.revocation_internal_reason ?? null,
      studentMessage: fee?.revocation_student_message ?? null,
      refundedAt: fee?.refunded_at ?? null,
      refundAmountArs: fee?.refund_amount_ars !== null && fee?.refund_amount_ars !== undefined ? Number(fee.refund_amount_ars) : null,
      refundMethod: fee?.refund_method ?? null,
      refundReference: fee?.refund_reference ?? null,
    };
  });

  return { records, migrationApplied, loadFailed: false };
}

export type PendingRevocationsSummary = {
  count: number;
  /** Antigüedad, en días, de la revocación sin resolver más vieja (null si no hay). */
  oldestAgeDays: number | null;
};

export function summarizePendingRevocations(records: RevocationRecord[], now: Date = new Date()): PendingRevocationsSummary {
  const pending = records.filter((r) => r.state === "pending");
  const dated = pending.filter((r) => r.revokedAt);
  if (dated.length === 0) return { count: pending.length, oldestAgeDays: null };
  const oldest = Math.min(...dated.map((r) => new Date(r.revokedAt!).getTime()));
  return { count: pending.length, oldestAgeDays: pendingAgeDays(new Date(oldest), now) };
}
