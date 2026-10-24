import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ResidenceSidebar } from "@/components/layout/ResidenceSidebar";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { countUnansweredStayChanges } from "@/lib/stayChange/load";
import { countNewApplications, countPendingQuestions } from "@/lib/residences/sidebarCounts";

/**
 * Sidebar de navegación de una residencia puntual (Ciclo 34sexdecies) —
 * a semejanza estructural de `estured_residence_admin_dashboard`. La
 * autorización de acceso a ESTA residencia (`assertResidenceAccess`)
 * sigue viviendo en cada page, como ya estaba — acá solo se resuelve la
 * sesión para no duplicar esa query en el layout.
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
  const admin = getSupabaseAdmin();
  if (admin && (await assertResidenceAccess(admin, user.id, residenceId))) {
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
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
