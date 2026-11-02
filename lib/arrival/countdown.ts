import { todayIso } from "@/lib/applications/reservationMoney";

/**
 * Cuenta regresiva de llegada (DR29). Trabaja con strings "YYYY-MM-DD" (date-only) y la fecha de hoy de Buenos Aires
 * (`todayIso`): NUNCA `new Date("YYYY-MM-DD")`, que se interpreta en UTC y desfasa un día.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayNumber(iso: string): number | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return Math.round(ms / 86_400_000);
}

/** Días enteros hasta `startDate`: 0 = hoy, 1 = mañana. Fecha pasada o inválida → null. */
export function daysUntil(startDate: string | null | undefined, today: string = todayIso()): number | null {
  if (!startDate) return null;
  const start = dayNumber(startDate);
  const now = dayNumber(today);
  if (start === null || now === null) return null;
  const diff = start - now;
  return diff < 0 ? null : diff;
}

/** Texto de la cuenta regresiva: «Hoy», «Mañana» o «Faltan N días». */
export function countdownLabel(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `Faltan ${days} días`;
}
