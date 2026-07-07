import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Valida que el usuario tenga residence_users activo para este
 * residence_id específico (docs/11 §7.3: no alcanza con validar el rol
 * general residence_owner/staff — hay que validar la residencia exacta,
 * por el aislamiento multi-residencia).
 */
export async function assertResidenceAccess(
  admin: SupabaseClient,
  userId: string,
  residenceId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("residence_users")
    .select("id")
    .eq("residence_id", residenceId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}
