import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * Bloqueo por falta de aceptación del reglamento (DR14, docs/06 §11.5). NO es un estado de la solicitud: se decide por la marca
 * `application_requests.regulation_acceptance_pending` Y la ausencia de la fila en `application_regulation_acceptances`. Las solicitudes
 * anteriores a la migración 0053 no tienen la marca (no se bloquean). Sin la migración, no bloquea nada. Ante un error de lectura que no sea
 * "falta el esquema" FALLA CERRADO (bloquea): no se avanza una solicitud cuya aceptación no se pudo verificar.
 */
export const REGULATION_PENDING_FOR_RESIDENCE_MESSAGE =
  "El estudiante todavía no leyó y aceptó el reglamento de la residencia. Podés avanzar esta solicitud apenas lo haga.";
export const REGULATION_GATE_CHECK_FAILED_MESSAGE = "No pudimos verificar la aceptación del reglamento. Probá de nuevo en unos minutos.";

export type RegulationGate = { pending: false } | { pending: true; checkFailed: boolean };

export async function getRegulationGate(admin: SupabaseClient, applicationId: string): Promise<RegulationGate> {
  const { data, error } = await admin.from("application_requests").select("regulation_acceptance_pending").eq("id", applicationId).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return { pending: false };
    console.error("[regulations] gate read failed:", error.code, error.message);
    return { pending: true, checkFailed: true };
  }
  if (!data || data.regulation_acceptance_pending !== true) return { pending: false };

  const { data: row, error: accError } = await admin
    .from("application_regulation_acceptances")
    .select("id")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (accError) {
    if (isMissingSchemaError(accError)) return { pending: false };
    console.error("[regulations] gate acceptance read failed:", accError.code, accError.message);
    return { pending: true, checkFailed: true };
  }
  return row ? { pending: false } : { pending: true, checkFailed: false };
}

/** Para las acciones de la residencia que avanzan la solicitud (contactar, proponer ajuste, habilitar o confirmar el pago). */
export async function assertRegulationAccepted(
  admin: SupabaseClient,
  applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await getRegulationGate(admin, applicationId);
  if (!gate.pending) return { ok: true };
  return { ok: false, error: gate.checkFailed ? REGULATION_GATE_CHECK_FAILED_MESSAGE : REGULATION_PENDING_FOR_RESIDENCE_MESSAGE };
}
