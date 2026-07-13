import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";

/**
 * Área residencia (docs/11 §7.3). Rol validado server-side.
 *
 * Sin chrome visual acá (Ciclo 34sexdecies): Next anida layouts, así que
 * si acá hubiera un header Y `[residence_id]/layout.tsx` agregara el
 * sidebar, quedarían los dos apilados. `/residence/dashboard` (selector
 * multi-residencia, sin una residencia activa todavía) arma su propio
 * header simple; `[residence_id]/layout.tsx` agrega el sidebar de
 * navegación real una vez que sí hay una residencia puntual.
 */
export default async function ResidenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/residence/dashboard");
  if (!hasAnyRole(user, ["residence_owner", "residence_staff"])) {
    redirect(roleHome(user));
  }

  return <>{children}</>;
}
