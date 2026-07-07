import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { AreaHeader } from "@/components/layout/AreaHeader";
import { Footer } from "@/components/layout/Footer";

/**
 * Área estudiante/familiar (docs/11 §7.2). El middleware ya exige
 * sesión; acá se valida el ROL server-side (docs/13 §6: manejar el
 * caso de permiso denegado — se redirige al home del rol real).
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
    <div className="flex min-h-screen flex-col">
      <AreaHeader areaLabel="Estudiantes" userEmail={user.email} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
