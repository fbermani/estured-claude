/**
 * Los 12 estados oficiales de `reservations.status` (docs/04 §7.2; enum
 * `reservation_status`, migración 0010) y cuáles se consideran VIGENTES.
 * Fuente única: antes cada consumidor armaba su propia lista a mano.
 */
export const RESERVATION_STATUSES = [
  "pending_estured_fee",
  "estured_fee_processing",
  "estured_fee_failed",
  "expired_fee_unpaid",
  "confirmed",
  "receipt_pending",
  "receipt_issued",
  "cancelled_by_student",
  "cancelled_by_residence",
  "no_show",
  "completed",
  "disputed",
] as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

/**
 * Reservas que ya no están en pie: el fee venció, se canceló, no se presentó o ya terminó.
 * `estured_fee_failed` NO está acá: docs/04 §7.2 permite reintentar el pago, así que sigue vigente.
 */
export const NON_LIVE_RESERVATION_STATUSES: readonly ReservationStatusValue[] = [
  "expired_fee_unpaid",
  "cancelled_by_student",
  "cancelled_by_residence",
  "no_show",
  "completed",
];

/** Reservas vigentes: todo menos `NON_LIVE_RESERVATION_STATUSES`. */
export const LIVE_RESERVATION_STATUSES: readonly ReservationStatusValue[] = RESERVATION_STATUSES.filter(
  (status) => !NON_LIVE_RESERVATION_STATUSES.includes(status),
);
