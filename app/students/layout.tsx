import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { StudentSidebar } from "@/components/layout/StudentSidebar";

/**
 * Área estudiante/familiar (docs/11 §7.2). El middleware ya exige
 * sesión; acá se valida el ROL server-side (docs/13 §6: manejar el
 * caso de permiso denegado — se redirige al home del rol real).
 *
 * Layout de sidebar fijo + contenido (Ciclo 34sexdecies) — a semejanza
 * estructural de design-references (`estured_dashboard_inicio_user_hub_1/_2`),
 * mismo patrón que ya usa `/admin`. Reemplaza el header horizontal
 * simple + footer de marketing (no tiene sentido un footer de landing
 * dentro de un dashboard autenticado).
 */
export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/students/dashboard");
  if (!hasAnyRole(user, ["student", "family_member"])) redirect(roleHome(user));

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <StudentSidebar userEmail={user.email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
