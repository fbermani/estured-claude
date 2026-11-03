import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Edad promedio actual de los residentes de una residencia (ficha pública, sección «Edad de los residentes»).
 *
 * Privacidad: es un agregado de TODA la comunidad vigente (no solo de quienes muestran su perfil), así que solo se
 * publica con más de `MIN_RESIDENTS_FOR_AVERAGE` edades válidas: con una comunidad chica, un promedio apuntaría a una
 * persona. Es una función pura (el «ahora» se inyecta) y la edad sale de `birth_date`, igual que `isMinorByBirthDate`.
 */
export const MIN_RESIDENTS_FOR_AVERAGE = 10;

const BUENOS_AIRES_TZ = "America/Argentina/Buenos_Aires";

function todayInBuenosAires(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUENOS_AIRES_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Edad en años cumplidos, o `null` si la fecha falta, es inválida o es futura. */
export function ageFromBirthDate(birthDate: string | null | undefined, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate ?? "");
  if (!match) return null;
  const [by, bm, bd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31) return null;
  const today = todayInBuenosAires(now);
  if (![today.y, today.m, today.d].every(Number.isFinite)) return null;
  let age = today.y - by;
  if (today.m < bm || (today.m === bm && today.d < bd)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** Promedio redondeado a años enteros, o `null` si hay `MIN_RESIDENTS_FOR_AVERAGE` edades válidas o menos. */
export function averageResidentAge(
  birthDates: Array<string | null | undefined>,
  now: Date = new Date(),
): { years: number; residents: number } | null {
  const ages = birthDates.map((b) => ageFromBirthDate(b, now)).filter((a): a is number => a != null);
  if (ages.length <= MIN_RESIDENTS_FOR_AVERAGE) return null;
  const mean = ages.reduce((sum, a) => sum + a, 0) / ages.length;
  return { years: Math.round(mean), residents: ages.length };
}

/**
 * Lee las fechas de nacimiento de las estadías vigentes y calcula el promedio. Solo con comunidad activa (Gestión
 * Operativa: sin ella las estadías no son confiables) y sin mostrar nunca una fecha individual. Si falla la consulta, `null`.
 */
export async function loadAverageResidentAge(
  admin: SupabaseClient,
  residenceId: string,
  hasOperationalManagement: boolean | null | undefined,
): Promise<{ years: number; residents: number } | null> {
  if (!hasOperationalManagement) return null;
  const { data, error } = await admin
    .from("resident_stays")
    .select("student_profiles(birth_date)")
    .eq("residence_id", residenceId)
    .eq("is_current", true)
    .eq("status", "active");
  if (error) {
    console.error("[ficha] no se pudo calcular la edad promedio:", error);
    return null;
  }
  const rows = (data ?? []) as unknown as Array<{ student_profiles: { birth_date: string | null } | { birth_date: string | null }[] | null }>;
  const dates = rows.map((r) => (Array.isArray(r.student_profiles) ? r.student_profiles[0]?.birth_date : r.student_profiles?.birth_date));
  return averageResidentAge(dates);
}
