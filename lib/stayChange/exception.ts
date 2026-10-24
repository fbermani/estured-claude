import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * Excepción a DR1 (Ciclo 59, DR3): mientras el estudiante tenga un aviso "Quiero cambiar" `open` (para menores:
 * ya confirmado por el familiar), el bloqueo por superposición con su reserva vigente NO aplica a sus solicitudes,
 * listas de espera y propuestas del familiar hacia OTRAS residencias (`docs/04` §5.6bis y §12bis.4).
 *
 * Sin `server-only` a propósito (mismo criterio que `reservationWindow.ts`, que lo importa): recibe el cliente de
 * Supabase por parámetro y sirve con el cliente admin (server actions) o con el del usuario (RLS "es mío").
 */
export type StayChangeException = {
  intentId: string;
  /** Residencia actual del estudiante: la excepción NO rige hacia ella. */
  currentResidenceId: string;
};

export type FindStayChangeExceptionResult = {
  exception: StayChangeException | null;
  /** `true` si no se pudo leer (el llamador decide: las server actions fallan cerradas). */
  failed: boolean;
};

export async function findStayChangeException(
  supabase: SupabaseClient,
  studentProfileId: string,
): Promise<FindStayChangeExceptionResult> {
  const { data, error } = await supabase
    .from("stay_change_intents")
    .select("id, current_residence_id")
    .eq("student_profile_id", studentProfileId)
    .eq("status", "open")
    .maybeSingle();
  // Migración 0044 sin aplicar: no hay avisos, rige DR1 como siempre.
  if (isMissingSchemaError(error)) return { exception: null, failed: false };
  if (error) {
    console.error("[stayChange] no se pudo leer el aviso abierto:", error);
    return { exception: null, failed: true };
  }
  if (!data) return { exception: null, failed: false };
  return { exception: { intentId: data.id as string, currentResidenceId: data.current_residence_id as string }, failed: false };
}

/** ¿La excepción rige hacia esa residencia? No hacia la actual. Falla CERRADO: sin residencia destino, no rige. */
export function exceptionAppliesToResidence(exception: StayChangeException | null, targetResidenceId: string): boolean {
  if (!exception || !targetResidenceId) return false;
  return exception.currentResidenceId !== targetResidenceId;
}
