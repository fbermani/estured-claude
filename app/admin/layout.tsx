import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { AreaHeader } from "@/components/layout/AreaHeader";

/** Panel admin (docs/09, docs/11 §7.4). Solo admin/superadmin. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/dashboard");
  if (!hasAnyRole(user, ["admin", "superadmin"])) redirect(roleHome(user));

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <AreaHeader areaLabel="Admin EstuRed" userEmail={user.email} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
