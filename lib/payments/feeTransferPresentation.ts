import { formatDateTime } from "@/lib/dates/format";

/**
 * Presentación pura del pago manual del fee (D2 / H02). Sin I/O.
 */

/**
 * Referencia que el estudiante pone en la transferencia: "EST-" + primeros
 * 8 caracteres del id de la reserva, en mayúsculas. Es derivada (no hay
 * columna): el admin la ve igual en `/admin/payments` para conciliar.
 */
export function reservationReference(reservationId: string): string {
  return `EST-${reservationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** CBU en bloques legibles: "0000000 0 00000000000000 0"-style → "00000000 0000000000000 0" (8 + 14). */
export function formatCbu(cbu: string): string {
  if (!/^\d{22}$/.test(cbu)) return cbu;
  return `${cbu.slice(0, 8)} ${cbu.slice(8)}`;
}

/** CUIT "20123456786" → "20-12345678-6". */
export function formatCuit(cuit: string): string {
  if (!/^\d{11}$/.test(cuit)) return cuit;
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
}

export type FeeCountdown = {
  expired: boolean;
  /** "1 d 3 h", "5 h 12 min", "42 min", "menos de 1 min" o "Plazo vencido". */
  remaining: string;
  /** "22/10/2026, 14:30" en hora de Buenos Aires. */
  absolute: string;
  /** Falta 12 h o menos (o ya venció). */
  urgent: boolean;
};

const MIN_MS = 60_000;

export function describeFeeCountdown(expiresAt: string | null | undefined, now: Date = new Date()): FeeCountdown | null {
  if (!expiresAt) return null;
  const deadline = new Date(expiresAt);
  if (Number.isNaN(deadline.getTime())) return null;
  const absolute = formatDateTime(deadline);
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return { expired: true, remaining: "Plazo vencido", absolute, urgent: true };

  const totalMin = Math.floor(ms / MIN_MS);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  let remaining: string;
  if (days > 0) remaining = `${days} d ${hours} h`;
  else if (hours > 0) remaining = `${hours} h ${minutes} min`;
  else if (minutes > 0) remaining = `${minutes} min`;
  else remaining = "menos de 1 min";
  return { expired: false, remaining, absolute, urgent: ms <= 12 * 60 * MIN_MS };
}

/** Enlace a Soporte para "Tengo un problema con el pago" (motivo propio dirigido a EstuRed, sin residencia). */
export function feeSupportHref(reservationId: string): string {
  return `/students/support?${new URLSearchParams({ motivo: "pago-fee", reserva: reservationId })}`;
}
