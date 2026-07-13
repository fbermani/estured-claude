import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ResidenceSidebar } from "@/components/layout/ResidenceSidebar";

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

  return (
    <div className="flex min-h-screen bg-cream">
      <ResidenceSidebar residenceId={residenceId} userEmail={user.email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
