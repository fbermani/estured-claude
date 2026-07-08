import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";

/** Roles de dominio (docs/06 §4.1). */
export type UserRole =
  | "guest"
  | "registered_user"
  | "student"
  | "family_member"
  | "residence_owner"
  | "residence_staff"
  | "admin"
  | "superadmin"
  | "system";

export interface SessionUser {
  id: string;
  email: string;
  primaryRole: UserRole;
  roles: UserRole[];
}

/**
 * Usuario de la sesión actual con sus roles activos, o null.
 * Lee con el cliente de sesión (anon + RLS): solo ve sus propias filas,
 * lo que además ejercita las policies en cada request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;

  const user = await getSafeUser(supabase);
  if (!user) return null;

  const [{ data: appUser }, { data: roleRows }] = await Promise.all([
    supabase
      .from("users")
      .select("email, primary_role, is_active, is_blocked")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  if (!appUser || !appUser.is_active || appUser.is_blocked) return null;

  return {
    id: user.id,
    email: appUser.email,
    primaryRole: appUser.primary_role as UserRole,
    roles: (roleRows ?? []).map((r) => r.role as UserRole),
  };
}

/** Home de cada rol (docs/08 §5.1). Familiar comparte área con estudiante. */
export function roleHome(user: SessionUser): string {
  if (user.roles.includes("admin") || user.roles.includes("superadmin")) {
    return "/admin/dashboard";
  }
  if (
    user.roles.includes("residence_owner") ||
    user.roles.includes("residence_staff")
  ) {
    return "/residence/dashboard";
  }
  return "/students/dashboard";
}

export function hasAnyRole(user: SessionUser, roles: UserRole[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}
