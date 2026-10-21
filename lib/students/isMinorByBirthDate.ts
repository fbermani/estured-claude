/**
 * H04 — "¿es menor?" calculado desde `student_profiles.birth_date` en el
 * servidor, no desde el flag `is_minor` (que se fija al registrarse y nunca
 * se recalcula). Función PURA: el "ahora" se inyecta.
 *
 * - La fecha de corte es el día calendario en Buenos Aires (UTC-3), no el
 *   del servidor: a las 22:00 del 14/3 en Argentina ya es 15/3 en UTC y no
 *   debería cumplir años un día antes.
 * - Se cumple 18 al COMENZAR el día del cumpleaños. Quien nació un 29/2
 *   cumple en años no bisiestos el 1/3 (criterio conservador).
 * - Sin `birth_date` (o con una fecha inválida) se trata como menor.
 */
const BUENOS_AIRES_TZ = "America/Argentina/Buenos_Aires";
const ADULT_AGE = 18;

function buenosAiresToday(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUENOS_AIRES_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function isMinorByBirthDate(birthDate: string | null | undefined, now: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate ?? "");
  if (!match) return true;
  const by = Number(match[1]);
  const bm = Number(match[2]);
  const bd = Number(match[3]);
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31) return true;

  const today = buenosAiresToday(now);
  if (![today.y, today.m, today.d].every(Number.isFinite)) return true;

  let age = today.y - by;
  if (today.m < bm || (today.m === bm && today.d < bd)) age -= 1;
  return age < ADULT_AGE;
}
