import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ResidenceSidebar } from "@/components/layout/ResidenceSidebar";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { countUnansweredStayChanges } from "@/lib/stayChange/load";
import { countNewApplications, countPendingQuestions } from "@/lib/residences/sidebarCounts";

/**
 * Sidebar de navegación de una residencia puntual (Ciclo 34sexdecies) —
 * a semejanza estructural de `estured_residence_admin_dashboard`. La
 * autorización de acceso a ESTA residencia (`assertResidenceAccess`)
 * sigue viviendo en cada page, como ya estaba — acá solo se resuelve la
 * sesión para no duplicar esa query en el layout. Desde el Ciclo 73 (DR10)
 * también se resuelve el rol del vínculo (dueño o staff) de ESTA residencia
 * para armar el menú: el staff no ve "Equipo". Es solo presentación; cada
 * acción y página solo-dueño valida el rol en el servidor.
 */
export default async function ResidenceDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/residence/dashboard");

  // Contador de avisos "Quiero cambiar" sin responder (DR3). Solo con acceso real a ESTA residencia; degrada a 0.
  let residentsBadge = 0;
  let applicationsBadge = 0;
  let faqBadge = 0;
  let isOwner = false;
  let canEditProfile = false;
  const admin = getSupabaseAdmin();
  const membership = admin ? await getResidenceMembership(admin, user.id, residenceId) : null;
  if (admin && membership) {
    isOwner = membership.role === "owner";
    canEditProfile = can(membership, "profile.edit");
    [residentsBadge, applicationsBadge, faqBadge] = await Promise.all([
      countUnansweredStayChanges(admin, residenceId),
      countNewApplications(admin, residenceId),
      countPendingQuestions(admin, residenceId),
    ]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <ResidenceSidebar
        residenceId={residenceId}
        userEmail={user.email}
        residentsBadge={residentsBadge}
        applicationsBadge={applicationsBadge}
        faqBadge={faqBadge}
        isOwner={isOwner}
        canEditProfile={canEditProfile}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
