import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ciclo 56 (hallazgo de seguridad del Ciclo 55): los datos PRIVADOS de una residencia viven en
 * `residence_private_details` (1:1 con `residences`, migración 0043), NO en `residences`. `residences` es legible
 * con la anon key para las verificadas (RLS filtra filas, no columnas), así que ahí no puede haber nada privado.
 *
 * La tabla privada tiene RLS sin policies y REVOKE a anon/authenticated: SOLO se accede con el cliente admin
 * (service role), desde server code. Nunca pasar un cliente de usuario a estas funciones ni agregar policies. La lista de columnas que no deben ser
 * legibles con la anon key vive en `scripts/sensitive-columns.json` (la usa el guard `scripts/check-anon-exposure.mjs`).
 *
 * Quien llama es responsable de autorizar (owner/staff de la residencia o admin). La dirección y la ubicación NO
 * van acá: decisión del dueño (2026-10-23), son información pública.
 */
export type ResidencePrivateDetails = {
  residence_id: string;
  responsible_name: string | null;
  responsible_contact: string | null;
  quality_visibility_status: "normal_visibility" | "warning" | "reduced_visibility";
  operational_access_granted_by: string | null;
  operational_access_granted_at: string | null;
  operational_access_reason: string | null;
  om_access_granted_by: string | null;
  om_access_granted_at: string | null;
};

export type ResidencePrivateDetailsPatch = Partial<Omit<ResidencePrivateDetails, "residence_id">>;

const SELECT_ALL =
  "residence_id, responsible_name, responsible_contact, quality_visibility_status, operational_access_granted_by, operational_access_granted_at, operational_access_reason, om_access_granted_by, om_access_granted_at";

export async function getResidencePrivateDetails(
  admin: SupabaseClient,
  residenceId: string,
): Promise<ResidencePrivateDetails | null> {
  const { data, error } = await admin
    .from("residence_private_details")
    .select(SELECT_ALL)
    .eq("residence_id", residenceId)
    .maybeSingle();
  if (error) {
    console.error("[residence-private] read failed:", error.message);
    return null;
  }
  return (data as ResidencePrivateDetails | null) ?? null;
}

/**
 * Crea o actualiza (UPSERT por `residence_id`) SOLO los campos del patch. Devuelve el mensaje de error de la base
 * (para loguear/hacer rollback) o `null` si fue bien.
 */
export async function saveResidencePrivateDetails(
  admin: SupabaseClient,
  residenceId: string,
  patch: ResidencePrivateDetailsPatch,
): Promise<{ message: string } | null> {
  const { error } = await admin
    .from("residence_private_details")
    .upsert({ residence_id: residenceId, ...patch }, { onConflict: "residence_id" });
  if (error) {
    console.error("[residence-private] save failed:", error.message);
    return { message: error.message };
  }
  return null;
}
