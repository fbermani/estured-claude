import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { cmd } from "@/components/admin/ui/tokens";

/**
 * Panel admin (docs/09, docs/11 §7.4). Solo admin/superadmin.
 *
 * Sistema visual "Operational Command" (ver components/admin/ui/tokens.ts)
 * — deliberadamente distinto del sitio público. Layout de dos columnas:
 * sidebar fija + workspace con scroll propio.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/dashboard");
  if (!hasAnyRole(user, ["admin", "superadmin"])) redirect(roleHome(user));

  const roleLabel = user.roles.includes("superadmin") ? "Superadmin" : "Admin";

  return (
    <div className="flex h-screen" style={{ backgroundColor: cmd.surface }}>
      <AdminSidebar userEmail={user.email} roleLabel={roleLabel} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
