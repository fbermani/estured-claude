import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getIsHoused } from "@/lib/students/isHoused";
import { StudentSidebar } from "@/components/layout/StudentSidebar";
import { SkipLink } from "@/components/ui/SkipLink";
import { InstallBanner } from "@/components/install/InstallBanner";

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
  let searchingChange = false;
  if (hasAnyRole(user, ["student"])) {
    const supabase = await getSupabaseServer();
    if (supabase) {
      isHoused = await getIsHoused(supabase);
      // "Quiero cambiar" (DR3): con el aviso abierto el alojado vuelve a ver "Buscar residencias" (RLS "es mío").
      if (isHoused) {
        const { data, error } = await supabase.from("stay_change_intents").select("id").eq("status", "open").limit(1);
        // Migración 0044 sin aplicar (tabla ausente): el menú queda como siempre.
        if (!error) searchingChange = (data ?? []).length > 0;
      }
    }
  }

  return (
    <div id="area-shell" className={`${hasAnyRole(user, ["student"]) ? "tone-student" : "tone-family"} flex min-h-screen flex-col bg-cream md:flex-row`}>
      <SkipLink />
      <StudentSidebar userEmail={user.email} isHoused={isHoused} searchingChange={searchingChange} />
      <main id="contenido" tabIndex={-1} className="min-w-0 focus:outline-none flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <InstallBanner />
        {children}
      </main>
    </div>
  );
}
