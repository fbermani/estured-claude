import { buildApplicationTimeline, type TimelineStep } from "@/lib/applications/timeline";

/**
 * Solicitudes que TERMINARON (vencida, rechazada, cancelada, reserva vencida/revocada, ingreso no concretado).
 * Presentación pura sobre `getVisibleStatus`: no agrega estados. Una "Estadía finalizada" (`completed`) no es un final
 * malo, así que no cuenta.
 */
export function isTerminalVisibleStatus(info: { isClosed: boolean; key: string }): boolean {
  return info.isClosed && info.key !== "completed";
}

/** Reserva anulada por el derecho de revocación del fee (docs/04 §7.3). */
export function isRevokedReservation(reservation: { status: string; cancellationReasonCode?: string | null } | null | undefined): boolean {
  return !!reservation && reservation.status === "cancelled_by_student" && reservation.cancellationReasonCode === "student_revocation_right";
}

export type TerminalSummary = {
  /** Solo los hitos que de verdad ocurrieron (nada "pendiente"/"frenado"). */
  steps: TimelineStep[];
  residencePaid: boolean;
  /** El fee llegó a pagarse y no fue anulado por revocación. */
  feePaid: boolean;
};

export function buildTerminalSummary(input: {
  applicationStatus: string;
  createdAt: string;
  contactEstablishedAt?: string | null;
  residencePaymentReportedAt?: string | null;
  feePaidAt?: string | null;
  reservationStatus?: string | null;
  revoked: boolean;
}): TerminalSummary {
  const all = buildApplicationTimeline({
    applicationStatus: input.applicationStatus,
    createdAt: input.createdAt,
    contactEstablishedAt: input.contactEstablishedAt,
    residencePaymentReportedAt: input.residencePaymentReportedAt,
    // Revocada: el fee y la confirmación quedaron sin efecto, no se marcan como logrados.
    feePaidAt: input.revoked ? null : input.feePaidAt,
    reservationConfirmedAt: null,
    reservationStatus: input.reservationStatus,
    isClosed: true,
  });
  const steps = all.filter((s) => s.state === "done" && s.key !== "confirmed");
  return {
    steps,
    residencePaid: steps.some((s) => s.key === "residence_payment"),
    feePaid: steps.some((s) => s.key === "fee"),
  };
}
