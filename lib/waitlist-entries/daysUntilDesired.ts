/**
 * Días que faltan hasta la fecha de ingreso deseada de una entrada de lista de espera (`date` de Postgres,
 * "YYYY-MM-DD"). Negativo = ya pasó; 0 = hoy; `null` = no hay fecha o no es válida (nunca NaN).
 *
 * Compara días calendario en hora de Buenos Aires (UTC-3, sin horario de verano), igual que el resto de las
 * fechas date-only de la app, para que "hoy" no cambie según el huso del servidor.
 * (Bug anterior: se armaba la fecha con el formato "DD/MM/YYYY" de `formatDateOnly` + "T00:00:00" → NaN.)
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const DAY_MS = 24 * 3600 * 1000;

export function daysUntilDesired(desiredStartDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!desiredStartDate) return null;
  const match = DATE_ONLY.exec(desiredStartDate);
  if (!match) return null;
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const ba = new Date(now.getTime() - 3 * 3600 * 1000);
  const today = Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate());
  const days = Math.round((desired - today) / DAY_MS);
  return Number.isFinite(days) ? days : null;
}

/** Texto entre paréntesis junto a "Ingreso deseado": "fecha vencida" / "hoy" / "en N días". `null` si no hay dato. */
export function describeDaysUntilDesired(days: number | null): string | null {
  if (days === null || !Number.isFinite(days)) return null;
  if (days < 0) return "fecha vencida";
  if (days === 0) return "hoy";
  return days === 1 ? "en 1 día" : `en ${days} días`;
}
