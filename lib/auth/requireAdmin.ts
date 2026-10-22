import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome, type SessionUser } from "@/lib/auth/session";

/**
 * Guards de rol del panel `/admin/*` (revisión de seguridad, Ciclo 50).
 *
 * El layout de `app/admin` ya redirige a quien no es admin, pero un layout no
 * protege por sí solo a una server action (se invoca por POST directo) ni
 * garantiza que cada página vuelva a chequear: cada `page.tsx` y cada action
 * bajo `app/admin/` llama a uno de estos helpers como primera línea.
 *
 * - `getAdminSession` / `getSuperadminSession`: para server actions, que
 *   devuelven un estado de error en vez de redirigir. Devuelven `null` si no
 *   hay sesión, la cuenta está bloqueada/inactiva (lo resuelve `getSessionUser`)
 *   o el rol no alcanza.
 * - `requireAdmin` / `requireSuperadmin`: para páginas; redirigen.
 */

export async function getAdminSession(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && hasAnyRole(user, ["admin", "superadmin"]) ? user : null;
}

export async function getSuperadminSession(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && user.roles.includes("superadmin") ? user : null;
}

/** Rol con el que se audita lo que hace este usuario en el panel. */
export function adminActorRole(user: SessionUser): "admin" | "superadmin" {
  return user.roles.includes("superadmin") ? "superadmin" : "admin";
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin/dashboard");
  if (!hasAnyRole(user, ["admin", "superadmin"])) redirect(roleHome(user));
  return user;
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await requireAdmin();
  if (!user.roles.includes("superadmin")) redirect("/admin/dashboard");
  return user;
}
