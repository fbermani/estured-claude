import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { AreaHeader } from "@/components/layout/AreaHeader";
import { Footer } from "@/components/layout/Footer";

/** Área residencia (docs/11 §7.3). Rol validado server-side. */
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

  return (
    <div className="flex min-h-screen flex-col">
      <AreaHeader areaLabel="Residencias" userEmail={user.email} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
