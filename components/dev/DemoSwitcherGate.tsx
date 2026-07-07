import { getSupabaseServer } from "@/lib/supabase/server";
import { DevUserSwitcher } from "@/components/dev/DevUserSwitcher";

/**
 * Gate server-side del selector de sesión simulada.
 * Solo se monta desde el root layout cuando DEMO_LOGIN_ENABLED=true
 * (sin el flag, el condicional se resuelve en build y las páginas
 * públicas siguen siendo estáticas). Lee la sesión actual para marcar
 * qué usuario demo está activo.
 */
export async function DemoSwitcherGate() {
  const supabase = await getSupabaseServer();
  let currentEmail: string | null = null;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentEmail = user?.email ?? null;
  }
  return <DevUserSwitcher currentEmail={currentEmail} />;
}
