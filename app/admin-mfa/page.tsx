import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { isAdminMfaSatisfied } from "@/lib/auth/adminMfa";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AdminMfaForm } from "@/app/admin-mfa/AdminMfaForm";

export const metadata: Metadata = { title: "Verificación en dos pasos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** DR65 (d): paso obligatorio antes del panel admin. Fuera de `/admin` para que su layout no lo redirija en bucle. */
export default async function AdminMfaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/dashboard");
  if (!hasAnyRole(user, ["admin", "superadmin"])) redirect(roleHome(user));
  const supabase = await getSupabaseServer();
  if (await isAdminMfaSatisfied(supabase)) redirect("/admin/dashboard");

  let hasFactor = false;
  if (supabase) {
    const { data } = await supabase.auth.mfa.listFactors();
    hasFactor = (data?.totp ?? []).some((f) => f.status === "verified");
  }

  return (
    <main id="contenido" className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-ink">Verificación en dos pasos</h1>
      <p className="mt-2 text-sm text-ink-soft">
        El panel de administración pide un código de tu app de autenticación (Google Authenticator, 1Password, Authy u otra).
      </p>
      <AdminMfaForm hasFactor={hasFactor} />
    </main>
  );
}
