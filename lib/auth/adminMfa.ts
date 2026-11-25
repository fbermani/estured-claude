import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isDemoLoginEnabled } from "@/lib/demoLogin";

/**
 * DR65 (d) (LEG-025): el panel admin exige MFA TOTP (`aal2`). Las acciones admin usan el service role, así que la exigencia vive acá
 * (guards de `requireAdmin.ts` y layout de `/admin`), no en RLS. Excepción del dueño: con el selector demo habilitado
 * (`isDemoLoginEnabled`, nunca en Production) no se exige, para que staging se pueda recorrer con los admins demo.
 */
export const ADMIN_MFA_PATH = "/admin-mfa";

export async function isAdminMfaSatisfied(client?: SupabaseClient | null): Promise<boolean> {
  if (isDemoLoginEnabled()) return true;
  const supabase = client ?? (await getSupabaseServer());
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.currentLevel === "aal2";
  } catch {
    // Igual que `getSafeUser`: una sesión rota nunca se trata como verificada.
    return false;
  }
}
