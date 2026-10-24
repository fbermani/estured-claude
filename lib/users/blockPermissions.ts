/**
 * Quién puede bloquear a quién (DR9, docs/00 §31 y docs/05 §5). Lógica pura:
 * la usan el servidor (`setUserBlockedStatus`, la regla real) y la lista de
 * usuarios (solo para ocultar el botón y explicar el motivo).
 *
 * - Nadie se bloquea a sí mismo.
 * - Un usuario "administrativo" (admin o superadmin, mirando `primary_role` y
 *   `user_roles`) solo lo bloquea/desbloquea un `superadmin`.
 * - El resto (estudiante, familiar, residencia, registrado) lo bloquea
 *   cualquier admin o superadmin.
 */

export type BlockDecision = { allowed: true } | { allowed: false; reason: string };

const ADMIN_ROLES = ["admin", "superadmin"];

export function isAdministrativeRoleSet(roles: readonly (string | null | undefined)[]): boolean {
  return roles.some((r) => r != null && ADMIN_ROLES.includes(r));
}

export function canBlockUser(params: {
  actorUserId: string;
  actorRoles: readonly string[];
  targetUserId: string;
  targetRoles: readonly (string | null | undefined)[];
}): BlockDecision {
  if (params.targetUserId === params.actorUserId) {
    return { allowed: false, reason: "No podés bloquear tu propia cuenta." };
  }
  const actorIsSuper = params.actorRoles.includes("superadmin");
  const actorIsAdmin = actorIsSuper || params.actorRoles.includes("admin");
  if (!actorIsAdmin) {
    return { allowed: false, reason: "No tenés permiso para bloquear usuarios." };
  }
  if (isAdministrativeRoleSet(params.targetRoles) && !actorIsSuper) {
    return {
      allowed: false,
      reason: "Solo un superadmin puede bloquear o desbloquear a otro admin o superadmin.",
    };
  }
  return { allowed: true };
}
