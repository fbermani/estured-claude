import { formatDateTime } from "@/lib/dates/format";

/**
 * Plazo de 48 h de `contact_established` / `residence_payment_pending`
 * (`application_requests.payment_deadline_at`, docs/04 l.302-303) listo para
 * mostrar. Presentación pura: el vencimiento real lo hace el job
 * `expireApplicationRequests` (H06/D6).
 */
export type PaymentDeadlineInfo = {
  /** "Vence en 5 h", "Vence en 2 días", "Vence en menos de 1 h" o "Plazo vencido". */
  relative: string;
  /** "23/10/2026, 14:30" en hora de Buenos Aires. */
  absolute: string;
  overdue: boolean;
  /** Falta 24 h o menos (o ya pasó). */
  urgent: boolean;
};

const HOUR_MS = 3_600_000;

export function describePaymentDeadline(
  deadlineAt: string | null | undefined,
  now: Date = new Date(),
): PaymentDeadlineInfo | null {
  if (!deadlineAt) return null;
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return null;

  const hours = (deadline.getTime() - now.getTime()) / HOUR_MS;
  const absolute = formatDateTime(deadline);
  if (hours <= 0) return { relative: "Plazo vencido", absolute, overdue: true, urgent: true };
  if (hours < 1) return { relative: "Vence en menos de 1 h", absolute, overdue: false, urgent: true };
  if (hours < 48) return { relative: `Vence en ${Math.round(hours)} h`, absolute, overdue: false, urgent: hours <= 24 };
  const days = Math.floor(hours / 24);
  return { relative: `Vence en ${days} ${days === 1 ? "día" : "días"}`, absolute, overdue: false, urgent: false };
}

/**
 * Plazo efectivo de una solicitud en `contact_established`: `payment_deadline_at`
 * y, para filas anteriores que no lo tienen, 48 h desde `contact_established_at`
 * (misma regla de respaldo que usa el job `expireApplicationRequests`).
 */
export function effectiveContactDeadline(
  paymentDeadlineAt: string | null | undefined,
  contactEstablishedAt: string | null | undefined,
): string | null {
  if (paymentDeadlineAt) return paymentDeadlineAt;
  if (!contactEstablishedAt) return null;
  const established = new Date(contactEstablishedAt);
  if (Number.isNaN(established.getTime())) return null;
  return new Date(established.getTime() + 48 * HOUR_MS).toISOString();
}
