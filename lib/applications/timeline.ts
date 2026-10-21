/**
 * Línea de tiempo simple de una solicitud (auditoría 2026-10-20, H07):
 * enviada → contacto → pago a la residencia → fee EstuRed → reserva
 * confirmada. Presentación pura: deriva el avance de timestamps ya leídos
 * y de los estados oficiales (docs/04 §5.2 solicitud, §7.2 reserva); no
 * agrega estados ni consulta nada. La próxima acción y el rótulo de estado
 * vienen de `getVisibleStatus` (H01), no se duplican acá.
 */

export type TimelineStepKey = "sent" | "contact" | "residence_payment" | "fee" | "confirmed";
export type TimelineStepState = "done" | "current" | "upcoming" | "stopped";

export type TimelineStep = {
  key: TimelineStepKey;
  label: string;
  state: TimelineStepState;
  /** ISO del hito, si se conoce. */
  at: string | null;
};

const CONTACT_REACHED = new Set([
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "residence_payment_pending",
  "residence_payment_reported",
  "converted_to_reservation",
]);
const PAYMENT_REACHED = new Set(["residence_payment_reported", "converted_to_reservation"]);
/** Estados de reserva en los que el fee ya está pagado (docs/04 §7.2). */
const FEE_PAID_RESERVATION = new Set([
  "confirmed",
  "receipt_pending",
  "receipt_issued",
  "completed",
  "no_show",
]);
const CONFIRMED_RESERVATION = new Set(["confirmed", "receipt_pending", "receipt_issued", "completed"]);

export function buildApplicationTimeline(input: {
  applicationStatus: string;
  createdAt: string;
  contactEstablishedAt?: string | null;
  residencePaymentReportedAt?: string | null;
  feePaidAt?: string | null;
  reservationConfirmedAt?: string | null;
  /** `reservations.status`, si la solicitud ya generó una reserva. */
  reservationStatus?: string | null;
  /** `getVisibleStatus(...).isClosed`: el proceso terminó sin completarse. */
  isClosed: boolean;
}): TimelineStep[] {
  const hasReservation = !!input.reservationStatus;
  const reached = [
    true,
    !!input.contactEstablishedAt || CONTACT_REACHED.has(input.applicationStatus) || hasReservation,
    !!input.residencePaymentReportedAt || PAYMENT_REACHED.has(input.applicationStatus) || hasReservation,
    !!input.feePaidAt || (!!input.reservationStatus && FEE_PAID_RESERVATION.has(input.reservationStatus)),
    !!input.reservationConfirmedAt ||
      (!!input.reservationStatus && CONFIRMED_RESERVATION.has(input.reservationStatus)),
  ];
  // Un hito posterior cumplido implica los anteriores (los datos viejos pueden no tener todos los timestamps).
  let lastDone = 0;
  reached.forEach((r, i) => {
    if (r) lastDone = i;
  });

  const defs: { key: TimelineStepKey; label: string; at: string | null }[] = [
    { key: "sent", label: "Solicitud enviada", at: input.createdAt },
    { key: "contact", label: "Contacto con la residencia", at: input.contactEstablishedAt ?? null },
    { key: "residence_payment", label: "Pago a la residencia", at: input.residencePaymentReportedAt ?? null },
    { key: "fee", label: "Fee EstuRed", at: input.feePaidAt ?? null },
    { key: "confirmed", label: "Reserva confirmada", at: input.reservationConfirmedAt ?? null },
  ];

  return defs.map((def, i) => {
    let state: TimelineStepState;
    if (i <= lastDone) state = "done";
    else if (i === lastDone + 1) state = input.isClosed ? "stopped" : "current";
    else state = "upcoming";
    return { ...def, state, at: state === "done" ? def.at : null };
  });
}
