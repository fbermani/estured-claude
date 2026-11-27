/**
 * Quién queda afuera del pixel de Meta (decisión del dueño 2026-11-27): una cuenta de estudiante menor de 18 con sesión iniciada.
 * La edad sale de `student_profiles.birth_date` (regla `isMinorByBirthDate`, no del flag `is_minor`). Sin sesión no se conoce la
 * edad y se mide; una cuenta sin perfil de estudiante (familiar, residencia) es de un adulto. Ante cualquier duda, no se mide.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";

export async function pixelIdForViewer(
  pixelId: string | null,
  userId: string | null,
  admin: SupabaseClient | null,
  now: Date = new Date(),
): Promise<string | null> {
  if (!pixelId) return null;
  if (!userId) return pixelId;
  if (!admin) return null;
  const { data, error } = await admin.from("student_profiles").select("birth_date").eq("user_id", userId).maybeSingle();
  if (error) return null;
  if (!data) return pixelId;
  return isMinorByBirthDate((data as { birth_date: string | null }).birth_date, now) ? null : pixelId;
}
