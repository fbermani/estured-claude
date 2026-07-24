import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/supabase/server";
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

  // isHoused reordena/renombra el menú lateral según el estado real del
  // estudiante (mismo criterio de app/students/dashboard/page.tsx: reserva
  // confirmada = alojado, docs/04 §7). Solo aplica a estudiantes — el
  // familiar acompaña la búsqueda de otra persona, no tiene estadía propia.
  let isHoused = false;
  if (hasAnyRole(user, ["student"])) {
    const supabase = await getSupabaseServer();
    if (supabase) {
      const { data } = await supabase
        .from("reservations")
        .select("id")
        .eq("status", "confirmed")
        .maybeSingle();
      isHoused = !!data;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <StudentSidebar userEmail={user.email} isHoused={isHoused} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
