import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { founderClosure, founderState, studentCounter, type FounderClosure, type FounderState, type StudentCounter } from "@/lib/preapertura/rules";

/**
 * Contadores REALES de la preapertura. Degradan sin lanzar: sin env vars de Supabase, sin la migración 0080 aplicada o ante
 * cualquier error devuelven el estado «desconocido» y la UI muestra el texto neutro («Sé de los primeros», «Solo 10 lugares…»).
 */

/** Estudiantes preinscriptos (cuentas con rol estudiante). `null` si no se pudo consultar. */
export async function getStudentCount(): Promise<number | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const { count, error } = await admin
      .from("preapertura_estudiantes")
      .select("id", { count: "exact", head: true })
      .eq("role", "student");
    // Una consulta HEAD a una tabla inexistente (0080 sin aplicar) vuelve sin `error` pero con `count` null: no es 0 real.
    if (error || count == null) return null;
    return count;
  } catch {
    return null;
  }
}

/**
 * Cupo de Residencias fundadoras: solicitudes del formulario público no descartadas + residencias en verificación que no vienen
 * de una solicitud (así no se cuenta dos veces la misma). Todo con conteos exactos de la base (`count: "exact", head: true`): sin
 * límites de filas ni subconteo. `null` si cualquiera de las consultas falla.
 */
export async function getFounderInputs(): Promise<{ externalSignups: number; otherInVerification: number } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const signups = await admin.from("residence_signup_requests").select("id", { count: "exact", head: true }).neq("status", "discarded");
    if (signups.error || signups.count == null) return null;
    const pending = await admin.from("residences").select("id", { count: "exact", head: true }).eq("status", "pending_verification");
    if (pending.error || pending.count == null) return null;
    // Las residencias en verificación que YA salen de una solicitud no descartada no se cuentan dos veces.
    const linked = await admin
      .from("residence_signup_requests")
      .select("id, residences!inner(status)", { count: "exact", head: true })
      .neq("status", "discarded")
      .eq("residences.status", "pending_verification");
    if (linked.error || linked.count == null) return null;
    return { externalSignups: signups.count, otherInVerification: Math.max(0, pending.count - linked.count) };
  } catch {
    return null;
  }
}

/**
 * Cierre de la convocatoria de fundadoras: sale de `FOUNDERS_CLOSE_AT` (ISO 8601, env del servidor). Sin la variable NO hay cuenta
 * regresiva ni se inventa una fecha (DR46.2).
 */
export function getFounderClosure(now: Date = new Date()): FounderClosure {
  return founderClosure(process.env.FOUNDERS_CLOSE_AT, now);
}

export async function getPreaperturaEntryData(): Promise<{ counter: StudentCounter; founders: FounderState; closure: FounderClosure }> {
  const [count, inputs] = await Promise.all([getStudentCount(), getFounderInputs()]);
  return { counter: studentCounter(count), founders: founderState(inputs), closure: getFounderClosure() };
}

/** Lugar real de un estudiante en la lista: cuántos estudiantes se registraron hasta su alta (incluido él). `null` si no se pudo consultar. */
export async function getStudentPosition(createdAt: string): Promise<number | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const { count, error } = await admin
      .from("preapertura_estudiantes")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .lte("created_at", createdAt);
    if (error || count == null) return null;
    return count;
  } catch {
    return null;
  }
}
