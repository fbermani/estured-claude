import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ageAtDate, todayIso } from "@/lib/residences/age";

/** `YYYY-MM-DD` válido y no absurdo (hasta 3 años a futuro), o null. Sirve para el parámetro `?ingreso=` de la búsqueda. */
export function parseIngresoParam(value: string | undefined, now: Date = new Date()): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() + 3);
  return parsed.getTime() <= limit.getTime() ? value : null;
}

/**
 * Edad del estudiante `userId` a `atDate` (por defecto hoy), con la fecha de nacimiento de su perfil (privada: nunca sale del servidor).
 * Null si no hay perfil o fecha de nacimiento: en ese caso la búsqueda no excluye nada (DR14).
 */
export async function getStudentAgeAt(userId: string, atDate: string = todayIso()): Promise<number | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.from("student_profiles").select("birth_date").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[studentAge] no se pudo leer la fecha de nacimiento:", error.message);
    return null;
  }
  return ageAtDate((data?.birth_date as string | null | undefined) ?? null, atDate);
}
