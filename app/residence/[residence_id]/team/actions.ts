"use server";

import { clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { permissionsFromChecked } from "@/lib/residences/permissions";
import {
  cancelTeamInvitation,
  inviteTeamMember,
  removeTeamMember,
  resendTeamInvitation,
  updateTeamMemberPermissions,
} from "@/lib/team/teamInvitations";

/** `warning`: la acción se hizo pero algo quedó a medias (la invitación se creó y el email no salió). */
export type TeamActionState = { status: "idle" | "ok" | "warning" | "error"; message?: string };

/**
 * Acciones de la pantalla Equipo (DR10). Todas son SOLO del dueño y esa regla se valida en `lib/team/teamInvitations`
 * (`assertResidenceOwner`): el rol sale de `residence_users`, nunca del formulario. El `residenceId` y los ids de la invitación o del
 * miembro llegan como argumentos ligados (URL), pero cada función los vuelve a cruzar con la residencia en el servidor.
 */
async function context() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { error: "Tu sesión expiró. Volvé a iniciar sesión." as const };
  const admin = getSupabaseAdmin();
  if (!admin) return { error: "No disponible en este momento. Probá más tarde." as const };
  const headerStore = await headers();
  return {
    sessionUser,
    admin,
    ipAddress: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

function refresh(residenceId: string) {
  revalidatePath(`/residence/${residenceId}/team`);
}

export async function inviteTeamMemberAction(
  residenceId: string,
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const ctx = await context();
  if ("error" in ctx) return { status: "error", message: ctx.error };
  const result = await inviteTeamMember(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    email: formData.get("email"),
    // Casilleros tildados (`name="permission"`): lo que no llega tildado queda apagado (un POST sin casilleros invita en solo lectura).
    permissions: permissionsFromChecked(formData.getAll("permission")),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  // La invitación quedó creada aunque el email no haya salido: se avisa y se puede reenviar desde la lista.
  return { status: result.emailSent ? "ok" : "warning", message: result.message };
}

export async function resendTeamInvitationAction(
  residenceId: string,
  invitationId: string,
  _prev: TeamActionState,
): Promise<TeamActionState> {
  const ctx = await context();
  if ("error" in ctx) return { status: "error", message: ctx.error };
  const result = await resendTeamInvitation(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    invitationId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  return { status: "ok", message: result.message };
}

export async function cancelTeamInvitationAction(
  residenceId: string,
  invitationId: string,
  _prev: TeamActionState,
): Promise<TeamActionState> {
  const ctx = await context();
  if ("error" in ctx) return { status: "error", message: ctx.error };
  const result = await cancelTeamInvitation(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    invitationId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  return { status: "ok", message: `Cancelamos la invitación a ${result.email}.` };
}

export async function removeTeamMemberAction(
  residenceId: string,
  memberUserId: string,
  _prev: TeamActionState,
): Promise<TeamActionState> {
  const ctx = await context();
  if ("error" in ctx) return { status: "error", message: ctx.error };
  const result = await removeTeamMember(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    memberUserId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  return { status: "ok", message: "Le quitamos el acceso a la residencia." };
}

/** Guardar los permisos de un staff. Solo el dueño (se valida en `updateTeamMemberPermissions`); el rol y el miembro salen de la base. */
export async function updateTeamMemberPermissionsAction(
  residenceId: string,
  memberUserId: string,
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const ctx = await context();
  if ("error" in ctx) return { status: "error", message: ctx.error };
  const result = await updateTeamMemberPermissions(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    memberUserId,
    permissions: permissionsFromChecked(formData.getAll("permission")),
    // Versión que leyó el formulario (campo oculto): si los permisos cambiaron mientras editaba, no se guarda. Sin el campo, falla.
    expectedVersion: String(formData.get("permissions_version") ?? ""),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  return { status: "ok", message: result.message };
}
