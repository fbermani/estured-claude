import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Funciones de Gestión Operativa (Plan Premium) — DR17 (docs/00 §31).
 * Es solo una SEÑAL VISUAL para el remarcado Premium: no bloquea nada en el servidor (D8: todo gratis en el MVP).
 * La fuente es `residences.has_operational_management_access` (docs/12 §15.3).
 */

/** Una sola lectura por request y residencia (el layout y la página la piden a la vez). `null` = no se pudo leer. */
const readOperationalAccess = cache(async (residenceId: string): Promise<boolean | null> => {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("residences")
    .select("has_operational_management_access")
    .eq("id", residenceId)
    .maybeSingle();
  if (error || !data) return null;
  return data.has_operational_management_access === true;
});

/** Estado real del plan: `true` Premium, `false` Perfil Verificado, `null` si no se pudo leer (no afirmar ningún plan). */
export async function getOperationalAccess(residenceId: string): Promise<boolean | null> {
  return readOperationalAccess(residenceId);
}

/**
 * `false` solo si se leyó con certeza que la residencia NO tiene Gestión Operativa. Ante un error de lectura o sin cliente
 * devuelve `true`: ante la duda no se remarca nada (el remarcado es decorativo y no debe confundir a quien sí tiene el plan).
 */
export async function hasOperationalManagementAccess(
  _admin: SupabaseClient | null,
  residenceId: string,
): Promise<boolean> {
  return (await readOperationalAccess(residenceId)) !== false;
}
