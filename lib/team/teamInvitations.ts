import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sendEmail";
import { createNotification } from "@/lib/notifications/createNotification";
import { assertResidenceOwner } from "@/lib/residences/access";
import {
  defaultPermissions,
  diffPermissions,
  ownerPermissions,
  normalizeResidenceRole,
  parseStrictPermissions,
  permissionLabel,
  permissionsVersion,
  resolveStaffPermissions,
  type PermissionMap,
  type ResidenceRole,
} from "@/lib/residences/permissions";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { generateInvitationToken, hashInvitationToken, isPlausibleInvitationToken } from "@/lib/team/invitationToken";
import {
  buildInvitationEmail,
  INVITE_EMAIL_FAILED_MESSAGE,
  INVITE_RESENT_MESSAGE,
  INVITE_SENT_MESSAGE,
  MEMBER_REMOVED_NOTICE,
  PERMISSIONS_CHANGED_NOTICE,
  PERMISSIONS_SAVED_MESSAGE,
  PERMISSIONS_STALE_MESSAGE,
  PERMISSIONS_UNAVAILABLE_MESSAGE,
  PERMISSIONS_UNCHANGED_MESSAGE,
  RESEND_EMAIL_FAILED_MESSAGE,
} from "@/lib/team/teamCopy";
import {
  canRemoveMember,
  checkInviteLimits,
  checkResendAllowed,
  checkResidenceCanInvite,
  INVALID_INVITATION_MESSAGE,
  INVITATION_TTL_DAYS,
  invitationExpiry,
  invitationView,
  isEligibleStaffAccount,
  isTerminalResidenceStatus,
  MAX_INVITATIONS_PER_HOUR,
  MAX_STAFF_PER_RESIDENCE,
  STAFF_LIMIT_ERROR,
  TEAM_FULL_ON_ACCEPT_MESSAGE,
  TEAM_UNAVAILABLE_MESSAGE,
  validateInviteEmail,
  type InvitationView,
} from "@/lib/team/teamRules";

/**
 * Equipo de una residencia (DR10, docs/00 §31): invitar, reenviar, cancelar, aceptar y quitar acceso. Cada función recibe el cliente
 * admin (service role) y valida TODO en el servidor: el rol sale de `residence_users` (nunca de un formulario), el `residence_id` de
 * cada fila se compara con el de la acción (no alcanza con conocer el id de una invitación o de un miembro) y el token solo existe en
 * claro en el enlace del email (en la base queda su SHA-256).
 *
 * Degradación: sin la migración 0051 (`residence_team_invitations`) no se puede invitar, reenviar ni cancelar (se avisa), pero la lista
 * de miembros y "quitar acceso" siguen andando porque solo usan `residence_users`.
 */

export type TeamResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export type TeamMember = {
  userId: string;
  email: string;
  role: ResidenceRole;
  since: string;
  /** Permisos resueltos (DR11). Para el dueño: todos encendidos (no se editan). */
  permissions: PermissionMap;
};

export type TeamInvitation = {
  id: string;
  email: string;
  view: InvitationView;
  sentAt: string;
  expiresAt: string;
};

export type TeamSnapshot = {
  members: TeamMember[];
  /** `null` si la tabla de invitaciones todavía no existe (migración 0051 sin aplicar). */
  invitations: TeamInvitation[] | null;
};

/** Columna que no existe (migración sin aplicar), distinto de "tabla que no existe". */
function isMissingColumnError(error: { code?: string | null; message?: string | null }): boolean {
  return error.code === "42703" || error.code === "PGRST204" || /could not find the .* column|column .* does not exist/i.test(error.message ?? "");
}

const GENERIC_ERROR = "No pudimos completar la acción. Intentá de nuevo en unos minutos.";
const ONE_HOUR_MS = 60 * 60 * 1000;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function invitationLink(token: string): string {
  return `${appUrl()}/register/staff/${token}`;
}

type MemberRow = {
  user_id: string;
  role: string | null;
  permissions: unknown;
  created_at: string;
  users: { email: string | null } | { email: string | null }[] | null;
};

/** Miembros activos (dueño y staff) y, si la tabla existe, invitaciones pendientes (vigentes y vencidas). */
export async function loadTeamSnapshot(
  admin: SupabaseClient,
  residenceId: string,
  now: Date = new Date(),
): Promise<TeamResult<TeamSnapshot>> {
  const { data: memberRows, error: memberError } = await admin
    .from("residence_users")
    // `users!user_id`: residence_users tiene dos FK a users (user_id e invited_by); sin la pista PostgREST devuelve PGRST201.
    .select("user_id, role, permissions, created_at, users!user_id(email)")
    .eq("residence_id", residenceId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (memberError) {
    console.error("[team] members read failed:", memberError.code, memberError.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  const members: TeamMember[] = ((memberRows ?? []) as unknown as MemberRow[]).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const role = normalizeResidenceRole(row.role);
    return {
      userId: row.user_id,
      email: (user?.email ?? "").toLowerCase(),
      role,
      since: row.created_at,
      permissions: role === "owner" ? ownerPermissions() : resolveStaffPermissions(row.permissions),
    };
  });

  const { data: inviteRows, error: inviteError } = await admin
    .from("residence_team_invitations")
    .select("id, email, status, expires_at, last_sent_at")
    .eq("residence_id", residenceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (inviteError) {
    if (isMissingSchemaError(inviteError)) return { ok: true, members, invitations: null };
    console.error("[team] invitations read failed:", inviteError.code, inviteError.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  const invitations: TeamInvitation[] = ((inviteRows ?? []) as {
    id: string;
    email: string;
    status: string;
    expires_at: string;
    last_sent_at: string;
  }[]).map((row) => ({
    id: row.id,
    email: row.email,
    view: invitationView(row, now),
    sentAt: row.last_sent_at,
    expiresAt: row.expires_at,
  }));
  return { ok: true, members, invitations };
}

/**
 * Cuántos emails de invitación (nuevos o reenvíos) salieron en la última hora desde esta residencia. Se cuenta desde `audit_logs`
 * (`team_invitation_sent` / `team_invitation_resent`, con `residence_id` en `new_value`), no desde las filas de invitaciones: una fila
 * reenviada varias veces es varios envíos y una cancelada también cuenta. Lanza ante un error de lectura (la acción falla cerrada).
 */
async function countSentLastHour(admin: SupabaseClient, residenceId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - ONE_HOUR_MS).toISOString();
  const { count, error } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .in("action", ["team_invitation_sent", "team_invitation_resent"])
    .eq("new_value->>residence_id", residenceId)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

/** Estado de la residencia (`null` si no se puede leer o no existe: quien llama falla cerrado). */
async function residenceStatus(admin: SupabaseClient, residenceId: string): Promise<string | null> {
  const { data, error } = await admin.from("residences").select("status").eq("id", residenceId).maybeSingle();
  if (error) {
    console.error("[team] residence status read failed:", error.code, error.message);
    return null;
  }
  const status = (data as { status?: unknown } | null)?.status;
  return typeof status === "string" ? status : null;
}

async function residenceName(admin: SupabaseClient, residenceId: string): Promise<string> {
  const { data } = await admin.from("residences").select("name").eq("id", residenceId).maybeSingle();
  return (data as { name?: string } | null)?.name ?? "una residencia";
}

/** Invitar a un staff por email. Rol fijo `staff`; respuesta neutra: no revela si existe una cuenta con ese email. */
export async function inviteTeamMember(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    email: unknown;
    /** Permisos iniciales que elige el dueño (mapa completo o parcial); se guardan en la invitación y se aplican al aceptar. Sin esto: valores por defecto. */
    permissions?: unknown;
    now?: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<TeamResult<{ email: string; message: string; emailSent: boolean }>> {
  const owner = await assertResidenceOwner(admin, params.actorUserId, params.residenceId);
  if (!owner.ok) return { ok: false, error: owner.error };

  const parsed = validateInviteEmail(params.email);
  if (!parsed.ok) return parsed;
  const now = params.now ?? new Date();

  try {
    const canInvite = checkResidenceCanInvite(await residenceStatus(admin, params.residenceId));
    if (!canInvite.ok) return canInvite;

    const snapshot = await loadTeamSnapshot(admin, params.residenceId, now);
    if (!snapshot.ok) return snapshot;
    if (snapshot.invitations === null) return { ok: false, error: TEAM_UNAVAILABLE_MESSAGE };

    // Solo se compara contra el equipo de ESTA residencia (el dueño ya ve esa lista): no se consulta si el email tiene cuenta.
    if (snapshot.members.some((m) => m.email === parsed.email)) {
      return { ok: false, error: "Esa persona ya forma parte del equipo de la residencia." };
    }
    const existing = snapshot.invitations.find((i) => i.email === parsed.email);
    if (existing) {
      return {
        ok: false,
        error:
          existing.view === "expired"
            ? "Esa invitación venció. Reenviala desde la lista de invitaciones pendientes."
            : "Esa persona ya tiene una invitación pendiente. Podés reenviarla o cancelarla desde la lista.",
      };
    }

    const sentLastHour = await countSentLastHour(admin, params.residenceId, now);
    const limits = checkInviteLimits({
      activeStaff: snapshot.members.filter((m) => m.role === "staff").length,
      pendingInvitations: snapshot.invitations.filter((i) => i.view === "pending").length,
      sentLastHour,
    });
    if (!limits.ok) return limits;

    // Permisos iniciales (DR11): se guardan en la invitación y se aplican al aceptar. Sin la columna (0051 sin la versión con permisos)
    // solo se puede invitar con los valores por defecto: guardar otros no es posible y aplicar los por defecto en silencio podría dar
    // MÁS permisos de los que eligió el dueño, así que en ese caso se rechaza con un mensaje claro.
    // Parser ESTRICTO: el mapa viene completo de los casilleros, así que una clave ausente es `false` (nunca el valor inicial).
    const permissions = params.permissions === undefined ? defaultPermissions() : parseStrictPermissions(params.permissions);
    const wantsDefaults = diffPermissions(defaultPermissions(), permissions).length === 0;
    const { token, hash } = generateInvitationToken();
    const baseRow = {
      residence_id: params.residenceId,
      email: parsed.email,
      role: "staff",
      token_hash: hash,
      invited_by: params.actorUserId,
      expires_at: invitationExpiry(now).toISOString(),
      last_sent_at: now.toISOString(),
    };
    let { data: inserted, error: insertError } = await admin
      .from("residence_team_invitations")
      .insert({ ...baseRow, permissions })
      .select("id")
      .single();
    if (insertError && isMissingColumnError(insertError)) {
      if (!wantsDefaults) return { ok: false, error: PERMISSIONS_UNAVAILABLE_MESSAGE };
      ({ data: inserted, error: insertError } = await admin.from("residence_team_invitations").insert(baseRow).select("id").single());
    }
    if (insertError || !inserted) {
      // 23505: otra invitación pendiente para el mismo email (carrera entre dos clics).
      if (insertError?.code === "23505") {
        return { ok: false, error: "Esa persona ya tiene una invitación pendiente. Podés reenviarla o cancelarla desde la lista." };
      }
      if (insertError && isMissingSchemaError(insertError)) return { ok: false, error: TEAM_UNAVAILABLE_MESSAGE };
      console.error("[team] invite insert failed:", insertError?.code, insertError?.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    const invitationId = (inserted as { id: string }).id;

    // Recuento DESPUÉS de insertar (tope de staff): dos invitaciones simultáneas pasan el chequeo previo, pero una de las dos (o las dos,
    // por seguridad) se pasa del tope acá y se cancela antes de mandar ningún email.
    const after = await loadTeamSnapshot(admin, params.residenceId, now);
    const overLimit =
      !after.ok ||
      after.invitations === null ||
      after.members.filter((m) => m.role === "staff").length + after.invitations.filter((i) => i.view === "pending").length >
        MAX_STAFF_PER_RESIDENCE;
    if (overLimit) {
      await admin
        .from("residence_team_invitations")
        .update({ status: "cancelled", cancelled_at: now.toISOString() })
        .eq("id", invitationId)
        .eq("status", "pending");
      return { ok: false, error: after.ok ? STAFF_LIMIT_ERROR : GENERIC_ERROR };
    }

    const mail = buildInvitationEmail({
      residenceName: await residenceName(admin, params.residenceId),
      link: invitationLink(token),
      expiresInDays: INVITATION_TTL_DAYS,
    });
    // El log se escribe ANTES de mandar el email y se recuenta el tope por hora con la invitación ya contada: dos POST simultáneos
    // pasan el chequeo previo, pero el recuento posterior frena a los que se pasan, antes de que salga cualquier email.
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: owner.actorRole,
      action: "team_invitation_sent",
      entityType: "residence_team_invitations",
      entityId: invitationId,
      newValue: { residence_id: params.residenceId, email: parsed.email, role: "staff" },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
    const sentAfterLog = await countSentLastHour(admin, params.residenceId, now);
    if (sentAfterLog > MAX_INVITATIONS_PER_HOUR) {
      await admin
        .from("residence_team_invitations")
        .update({ status: "cancelled", cancelled_at: now.toISOString() })
        .eq("id", invitationId)
        .eq("status", "pending");
      return { ok: false, error: "Enviaste muchas invitaciones en poco tiempo. Probá de nuevo en un rato." };
    }

    const emailSent = await sendEmail({ to: parsed.email, subject: mail.subject, html: mail.html });

    return {
      ok: true,
      email: parsed.email,
      emailSent: !!emailSent,
      message: emailSent ? INVITE_SENT_MESSAGE(parsed.email) : INVITE_EMAIL_FAILED_MESSAGE,
    };
  } catch (error) {
    console.error("[team] invite failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Reenviar una invitación pendiente (vigente o vencida): token nuevo, 7 días más; el enlace anterior deja de funcionar.
 *
 * Orden pensado para no dejar a nadie sin enlace: primero se manda el email con el token nuevo y SOLO si salió se rota el token en la
 * base. Si el email no sale, la invitación queda exactamente como estaba (el enlace anterior sigue sirviendo), no cuenta como envío y se
 * le avisa al dueño. Límites: espera de 10 minutos entre envíos de la misma invitación, tope de 5 envíos por invitación y de 5 envíos
 * por hora y por residencia; y no se reenvía si la residencia está en borrador, rechazada, suspendida o archivada.
 */
export async function resendTeamInvitation(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    invitationId: string;
    now?: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<TeamResult<{ email: string; message: string }>> {
  const owner = await assertResidenceOwner(admin, params.actorUserId, params.residenceId);
  if (!owner.ok) return { ok: false, error: owner.error };
  const now = params.now ?? new Date();

  try {
    // Se filtra por residencia además del id: una invitación de otra residencia es "no encontrada".
    const { data: invitation, error } = await admin
      .from("residence_team_invitations")
      .select("id, email, status, send_count, last_sent_at, expires_at")
      .eq("id", params.invitationId)
      .eq("residence_id", params.residenceId)
      .maybeSingle();
    if (error) {
      if (isMissingSchemaError(error)) return { ok: false, error: TEAM_UNAVAILABLE_MESSAGE };
      console.error("[team] resend read failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    const row = invitation as { id: string; email: string; status: string; send_count: number; last_sent_at: string | null; expires_at: string } | null;
    if (!row) return { ok: false, error: "No encontramos esa invitación." };
    if (row.status !== "pending") return { ok: false, error: "Esa invitación ya no está pendiente." };

    const canInvite = checkResidenceCanInvite(await residenceStatus(admin, params.residenceId));
    if (!canInvite.ok) return canInvite;

    const allowed = checkResendAllowed({ lastSentAt: row.last_sent_at, sendCount: row.send_count }, now);
    if (!allowed.ok) return allowed;

    const sentLastHour = await countSentLastHour(admin, params.residenceId, now);
    // Reenviar una invitación VIGENTE no suma un lugar (ya ocupaba uno). Reenviar una VENCIDA sí: ya no ocupaba ninguno (las vencidas no
    // cuentan para el tope), así que revivirla es como invitar de nuevo y se cuenta con los staff activos y las pendientes vigentes reales.
    const expired = invitationView({ status: row.status, expires_at: row.expires_at }, now) === "expired";
    let limits: { ok: true } | { ok: false; error: string };
    if (expired) {
      const snapshot = await loadTeamSnapshot(admin, params.residenceId, now);
      if (!snapshot.ok) return snapshot;
      if (snapshot.invitations === null) return { ok: false, error: TEAM_UNAVAILABLE_MESSAGE };
      limits = checkInviteLimits({
        activeStaff: snapshot.members.filter((m) => m.role === "staff").length,
        pendingInvitations: snapshot.invitations.filter((i) => i.view === "pending").length,
        sentLastHour,
      });
    } else {
      limits = checkInviteLimits({ activeStaff: 0, pendingInvitations: 0, sentLastHour }, { forResend: true });
    }
    if (!limits.ok) return limits;

    const { token, hash } = generateInvitationToken();
    const mail = buildInvitationEmail({
      residenceName: await residenceName(admin, params.residenceId),
      link: invitationLink(token),
      expiresInDays: INVITATION_TTL_DAYS,
    });
    const emailSent = await sendEmail({ to: row.email, subject: mail.subject, html: mail.html });
    if (!emailSent) return { ok: false, error: RESEND_EMAIL_FAILED_MESSAGE };

    const { data: updated, error: updateError } = await admin
      .from("residence_team_invitations")
      .update({
        token_hash: hash,
        expires_at: invitationExpiry(now).toISOString(),
        last_sent_at: now.toISOString(),
        send_count: (row.send_count ?? 1) + 1,
      })
      .eq("id", row.id)
      .eq("residence_id", params.residenceId)
      .eq("status", "pending")
      .select("id");
    if (updateError) {
      console.error("[team] resend update failed:", updateError.code, updateError.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!updated || updated.length === 0) return { ok: false, error: "Esa invitación ya no está pendiente." };

    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: owner.actorRole,
      action: "team_invitation_resent",
      entityType: "residence_team_invitations",
      entityId: row.id,
      newValue: { residence_id: params.residenceId, email: row.email },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });

    return { ok: true, email: row.email, message: INVITE_RESENT_MESSAGE(row.email) };
  } catch (error) {
    console.error("[team] resend failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Cancelar una invitación pendiente: el enlace deja de funcionar. */
export async function cancelTeamInvitation(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    invitationId: string;
    now?: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<TeamResult<{ email: string }>> {
  const owner = await assertResidenceOwner(admin, params.actorUserId, params.residenceId);
  if (!owner.ok) return { ok: false, error: owner.error };
  const now = params.now ?? new Date();

  try {
    const { data: invitation, error } = await admin
      .from("residence_team_invitations")
      .select("id, email, status")
      .eq("id", params.invitationId)
      .eq("residence_id", params.residenceId)
      .maybeSingle();
    if (error) {
      if (isMissingSchemaError(error)) return { ok: false, error: TEAM_UNAVAILABLE_MESSAGE };
      console.error("[team] cancel read failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    const row = invitation as { id: string; email: string; status: string } | null;
    if (!row) return { ok: false, error: "No encontramos esa invitación." };
    if (row.status !== "pending") return { ok: false, error: "Esa invitación ya no está pendiente." };

    const { data: updated, error: updateError } = await admin
      .from("residence_team_invitations")
      .update({ status: "cancelled", cancelled_at: now.toISOString() })
      .eq("id", row.id)
      .eq("residence_id", params.residenceId)
      .eq("status", "pending")
      .select("id");
    if (updateError) {
      console.error("[team] cancel update failed:", updateError.code, updateError.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!updated || updated.length === 0) return { ok: false, error: "Esa invitación ya no está pendiente." };

    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: owner.actorRole,
      action: "team_invitation_cancelled",
      entityType: "residence_team_invitations",
      entityId: row.id,
      newValue: { residence_id: params.residenceId, email: row.email },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
    return { ok: true, email: row.email };
  } catch (error) {
    console.error("[team] cancel failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Quitar el acceso a un staff: `is_active = false` e `invitation_status = 'revoked'` (no se borra la fila). Solo el dueño, solo a un
 * staff activo; nadie se quita a sí mismo y la residencia nunca queda sin dueño (`canRemoveMember`).
 */
export async function removeTeamMember(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    memberUserId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<TeamResult> {
  const owner = await assertResidenceOwner(admin, params.actorUserId, params.residenceId);
  if (!owner.ok) return { ok: false, error: owner.error };

  try {
    const { data: rows, error } = await admin
      .from("residence_users")
      .select("user_id, role, is_active")
      .eq("residence_id", params.residenceId);
    if (error) {
      console.error("[team] remove read failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    const all = (rows ?? []) as { user_id: string; role: string | null; is_active: boolean }[];
    const target = all.find((r) => r.user_id === params.memberUserId) ?? null;
    const decision = canRemoveMember({
      actorUserId: params.actorUserId,
      actorRole: "owner",
      target: target ? { userId: target.user_id, role: normalizeResidenceRole(target.role), isActive: target.is_active } : null,
      activeOwnerCount: all.filter((r) => r.is_active && r.role === "owner").length,
    });
    if (!decision.allowed) return { ok: false, error: decision.error };

    // Update condicional: solo si sigue siendo un staff activo de ESTA residencia (evita pisar un cambio de otra pestaña).
    const { data: updated, error: updateError } = await admin
      .from("residence_users")
      .update({ is_active: false, invitation_status: "revoked" })
      .eq("residence_id", params.residenceId)
      .eq("user_id", params.memberUserId)
      .eq("role", "staff")
      .eq("is_active", true)
      .select("user_id");
    if (updateError) {
      console.error("[team] remove update failed:", updateError.code, updateError.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!updated || updated.length === 0) return { ok: false, error: "Esa persona ya no tiene acceso a la residencia." };

    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: owner.actorRole,
      action: "team_member_removed",
      entityType: "residence_users",
      entityId: params.memberUserId,
      oldValue: { residence_id: params.residenceId, role: "staff", is_active: true },
      newValue: { residence_id: params.residenceId, is_active: false, invitation_status: "revoked" },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });

    // Aviso in-app a quien perdió el acceso (sin enlace: la residencia ya no le abre). Best-effort.
    const notice = MEMBER_REMOVED_NOTICE(await residenceName(admin, params.residenceId));
    await createNotification(admin, { userId: params.memberUserId, title: notice.title, body: notice.body });
    return { ok: true };
  } catch (error) {
    console.error("[team] remove failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Cambiar los permisos de un staff (DR11). Solo el dueño, solo a un staff activo de ESTA residencia (el dueño no se edita a sí mismo ni a
 * otro dueño: siempre puede todo). Guarda el mapa completo en `residence_users.permissions` con un update condicional, audita
 * (`team_permissions_changed`, con las claves que cambiaron) y le avisa al staff con un aviso in-app genérico. Sin cambios no escribe.
 * El mapa llega del formulario ya reducido a claves conocidas (`permissionsFromChecked`); las claves desconocidas nunca se guardan.
 */
export async function updateTeamMemberPermissions(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    memberUserId: string;
    permissions: unknown;
    /**
     * Versión (`permissionsVersion`) de los permisos que leyó el formulario. Si se pasa y ya no coincide con los permisos efectivos de
     * hoy (otra pestaña u otro dueño los cambió mientras se editaba), no se guarda nada y se pide recargar. El formulario de Equipo
     * siempre la manda: un POST sin ella falla.
     */
    expectedVersion?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<TeamResult<{ message: string; changed: number }>> {
  const owner = await assertResidenceOwner(admin, params.actorUserId, params.residenceId);
  if (!owner.ok) return { ok: false, error: owner.error };

  try {
    const { data: row, error } = await admin
      .from("residence_users")
      .select("user_id, role, is_active, permissions")
      .eq("residence_id", params.residenceId)
      .eq("user_id", params.memberUserId)
      .maybeSingle();
    if (error) {
      console.error("[team] permissions read failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    const member = row as { user_id: string; role: string | null; is_active: boolean; permissions: unknown } | null;
    if (!member || !member.is_active) return { ok: false, error: "No encontramos a esa persona en el equipo." };
    if (normalizeResidenceRole(member.role) === "owner" || member.user_id === params.actorUserId) {
      return { ok: false, error: "Los permisos de un dueño no se editan: el dueño siempre puede hacer todo." };
    }

    const before = resolveStaffPermissions(member.permissions);
    if (params.expectedVersion !== undefined && params.expectedVersion !== permissionsVersion(before)) {
      return { ok: false, error: PERMISSIONS_STALE_MESSAGE };
    }
    // Parser ESTRICTO: el mapa viene completo de los casilleros; una clave ausente es `false`, no el valor inicial.
    const after = parseStrictPermissions(params.permissions);
    const changes = diffPermissions(before, after);
    if (changes.length === 0) return { ok: true, message: PERMISSIONS_UNCHANGED_MESSAGE, changed: 0 };

    // Update condicional: solo si sigue siendo un staff activo de ESTA residencia.
    const { data: updated, error: updateError } = await admin
      .from("residence_users")
      .update({ permissions: after })
      .eq("residence_id", params.residenceId)
      .eq("user_id", params.memberUserId)
      .eq("role", "staff")
      .eq("is_active", true)
      .select("user_id");
    if (updateError) {
      console.error("[team] permissions update failed:", updateError.code, updateError.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!updated || updated.length === 0) return { ok: false, error: "Esa persona ya no tiene acceso a la residencia." };

    const from: Record<string, boolean> = {};
    const to: Record<string, boolean> = {};
    for (const c of changes) {
      from[c.key] = c.from;
      to[c.key] = c.to;
    }
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: owner.actorRole,
      action: "team_permissions_changed",
      entityType: "residence_users",
      entityId: params.memberUserId,
      oldValue: { residence_id: params.residenceId, permissions: from },
      newValue: {
        residence_id: params.residenceId,
        permissions: to,
        changed_keys: changes.map((c) => c.key),
        changed_labels: changes.map((c) => permissionLabel(c.key)),
      },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });

    // Aviso in-app genérico al staff (sin enlace: el detalle lo ve en su Panel). Best-effort.
    const notice = PERMISSIONS_CHANGED_NOTICE(await residenceName(admin, params.residenceId));
    await createNotification(admin, { userId: params.memberUserId, title: notice.title, body: notice.body });

    const { data: user } = await admin.from("users").select("email").eq("id", params.memberUserId).maybeSingle();
    const email = (user as { email?: string | null } | null)?.email ?? "esa persona";
    return { ok: true, message: PERMISSIONS_SAVED_MESSAGE(email), changed: changes.length };
  } catch (error) {
    console.error("[team] permissions failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ==== Aceptación ====

export type PeekInvitationResult =
  | { state: "valid"; email: string; residenceId: string; residenceName: string }
  | { state: "invalid" };

type InvitationRow = {
  id: string;
  residence_id: string;
  email: string;
  status: string;
  /** Nullable (0051): si se borra al usuario que invitó, queda en `null` y la invitación ya no se puede aceptar. */
  invited_by: string | null;
  expires_at: string;
  /** Permisos iniciales elegidos al invitar (DR11); ausente si la columna no existe todavía. */
  permissions?: unknown;
};

async function findInvitationByToken(admin: SupabaseClient, rawToken: unknown): Promise<InvitationRow | "unavailable" | null> {
  if (!isPlausibleInvitationToken(rawToken)) return null;
  const hash = hashInvitationToken(rawToken);
  const lookup = (columns: string) =>
    admin.from("residence_team_invitations").select(columns).eq("token_hash", hash).maybeSingle();
  let { data, error } = await lookup("id, residence_id, email, status, invited_by, expires_at, permissions");
  // Sin la columna de permisos iniciales (0051 sin la versión con permisos) se lee igual, y al aceptar rigen los valores por defecto.
  if (error && isMissingColumnError(error)) ({ data, error } = await lookup("id, residence_id, email, status, invited_by, expires_at"));
  if (error) {
    if (isMissingSchemaError(error)) return "unavailable";
    console.error("[team] token lookup failed:", error.code, error.message);
    return null;
  }
  return (data as unknown as InvitationRow | null) ?? null;
}

/**
 * Una invitación pendiente solo se puede ver o aceptar si SIGUE siendo válida para quien la envió: la persona que invitó tiene que seguir
 * siendo dueña activa de esa residencia (si se le quitó el acceso, la invitación murió con él) y la residencia no puede estar en un
 * estado terminal (rechazada, suspendida, archivada). Ante cualquier duda, falla cerrado.
 */
async function invitationStillUsable(admin: SupabaseClient, invitation: InvitationRow): Promise<boolean> {
  if (!invitation.invited_by) return false;
  const owner = await assertResidenceOwner(admin, invitation.invited_by, invitation.residence_id);
  if (!owner.ok) return false;
  return !isTerminalResidenceStatus(await residenceStatus(admin, invitation.residence_id));
}

/** Mira un enlace sin consumirlo (para la pantalla de aceptación). Inválido, vencido, usado, cancelado o sin tabla: todos `invalid`. */
export async function peekTeamInvitation(
  admin: SupabaseClient,
  rawToken: unknown,
  now: Date = new Date(),
): Promise<PeekInvitationResult> {
  const row = await findInvitationByToken(admin, rawToken);
  if (!row || row === "unavailable") return { state: "invalid" };
  if (invitationView(row, now) !== "pending") return { state: "invalid" };
  if (!(await invitationStillUsable(admin, row))) return { state: "invalid" };
  return { state: "valid", email: row.email, residenceId: row.residence_id, residenceName: await residenceName(admin, row.residence_id) };
}

export type AcceptResult =
  | { ok: true; residenceId: string; alreadyMember: boolean }
  | { ok: false; code: "invalid" | "email_mismatch" | "not_eligible" | "failed"; error: string };

export const EMAIL_MISMATCH_MESSAGE = "Esta invitación es para otro email. Ingresá con el email al que te la enviaron.";
export const NOT_ELIGIBLE_MESSAGE =
  "Con esta cuenta no se puede sumar al equipo de una residencia. Usá otro email o escribinos por Soporte.";

/**
 * Aceptar una invitación con una cuenta ya autenticada. Reglas (DR10):
 *  - el token tiene que existir (hash), estar pendiente y vigente; un enlace inválido/vencido/usado/cancelado da el mismo mensaje;
 *  - la cuenta tiene que usar el email invitado;
 *  - quien invitó sigue siendo dueño activo de esa residencia y la residencia no está rechazada, suspendida ni archivada (si no, enlace inválido);
 *  - solo cuentas de residencia (dueño o staff) activas y no bloqueadas, y SIN rol de admin, superadmin ni estudiante (un familiar que
 *    además es dueño de una residencia sí puede aceptar);
 *  - un solo uso: la invitación se reclama con un UPDATE condicional antes de crear el vínculo (si el vínculo falla, se devuelve);
 *  - el vínculo siempre es `staff` (nunca se eleva a dueño, ni se pisa un vínculo `owner` existente).
 */
export async function acceptTeamInvitation(
  admin: SupabaseClient,
  params: { rawToken: unknown; userId: string; userEmail: string; now?: Date; ipAddress?: string | null; userAgent?: string | null },
): Promise<AcceptResult> {
  const now = params.now ?? new Date();
  const invalid: AcceptResult = { ok: false, code: "invalid", error: INVALID_INVITATION_MESSAGE };

  try {
    const invitation = await findInvitationByToken(admin, params.rawToken);
    if (!invitation || invitation === "unavailable") return invalid;
    if (invitationView(invitation, now) !== "pending") return invalid;
    // Quien invitó tiene que seguir siendo dueño y la residencia no puede estar en un estado terminal: mismo mensaje neutro.
    if (!(await invitationStillUsable(admin, invitation))) return invalid;
    if (invitation.email !== params.userEmail.trim().toLowerCase()) {
      return { ok: false, code: "email_mismatch", error: EMAIL_MISMATCH_MESSAGE };
    }

    const [{ data: user }, { data: roleRows }] = await Promise.all([
      admin.from("users").select("is_active, is_blocked").eq("id", params.userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", params.userId).eq("is_active", true),
    ]);
    const u = user as { is_active: boolean | null; is_blocked: boolean | null } | null;
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    const eligible = !!u && isEligibleStaffAccount({ isActive: u.is_active, isBlocked: u.is_blocked, roles });
    if (!eligible) return { ok: false, code: "not_eligible", error: NOT_ELIGIBLE_MESSAGE };

    const { data: existing, error: existingError } = await admin
      .from("residence_users")
      .select("id, role, is_active")
      .eq("residence_id", invitation.residence_id)
      .eq("user_id", params.userId)
      .maybeSingle();
    if (existingError) {
      console.error("[team] accept membership read failed:", existingError.code, existingError.message);
      return { ok: false, code: "failed", error: GENERIC_ERROR };
    }
    const current = existing as { id: string; role: string | null; is_active: boolean } | null;
    // Un vínculo de dueño (activo o no) nunca se toca desde una invitación de staff.
    if (current && current.role === "owner") return { ok: false, code: "not_eligible", error: NOT_ELIGIBLE_MESSAGE };

    // Tope de staff también al ACEPTAR: una invitación vencida reenviada, o dos invitaciones simultáneas, pueden haber dejado a la
    // residencia con el cupo lleno. Se chequea ANTES de reclamar la invitación para no consumirla (puede reintentar cuando haya lugar).
    // Quien ya es staff activo (re-aceptar) no suma una persona.
    if (!(current && current.is_active)) {
      const { data: activeStaffRows, error: activeStaffError } = await admin
        .from("residence_users")
        .select("user_id")
        .eq("residence_id", invitation.residence_id)
        .eq("role", "staff")
        .eq("is_active", true);
      if (activeStaffError) {
        console.error("[team] accept staff count failed:", activeStaffError.code, activeStaffError.message);
        return { ok: false, code: "failed", error: GENERIC_ERROR };
      }
      if ((activeStaffRows ?? []).length >= MAX_STAFF_PER_RESIDENCE) {
        return { ok: false, code: "failed", error: TEAM_FULL_ON_ACCEPT_MESSAGE };
      }
    }

    // Reclamo de un solo uso: si dos pedidos llegan juntos, solo uno actualiza la fila.
    const { data: claimed, error: claimError } = await admin
      .from("residence_team_invitations")
      .update({ status: "accepted", accepted_at: now.toISOString(), accepted_by_user_id: params.userId })
      .eq("id", invitation.id)
      .eq("status", "pending")
      .gt("expires_at", now.toISOString())
      .select("id");
    if (claimError) {
      console.error("[team] accept claim failed:", claimError.code, claimError.message);
      return { ok: false, code: "failed", error: GENERIC_ERROR };
    }
    if (!claimed || claimed.length === 0) return invalid;

    const alreadyMember = !!current && current.is_active;
    // Permisos que eligió el dueño al invitar. Una invitación sin la columna (0051 vieja) o con `{}` da los valores iniciales; un valor que
    // no es un objeto (no debería pasar: la columna tiene un CHECK) falla cerrado y no da ningún permiso. Se escriben completos.
    const initialPermissions = invitation.permissions === undefined ? defaultPermissions() : resolveStaffPermissions(invitation.permissions);
    let membershipError: { code?: string; message?: string } | null = null;
    if (!alreadyMember) {
      if (current) {
        // Reactivar: el UPDATE puede no afectar ninguna fila (el vínculo cambió de rol o desapareció entre la lectura y acá). Sin fila
        // afectada no hay acceso, así que se trata como error: se devuelve la invitación a `pending` (rollback) y se responde neutro.
        const { data: reactivated, error } = await admin
          .from("residence_users")
          .update({ is_active: true, invitation_status: "accepted", invited_by: invitation.invited_by, permissions: initialPermissions })
          .eq("id", current.id)
          .eq("residence_id", invitation.residence_id)
          .eq("role", "staff")
          .select("id");
        membershipError = error ?? (reactivated && reactivated.length > 0 ? null : { code: "no_rows", message: "reactivation affected no rows" });
      } else {
        const { error } = await admin.from("residence_users").insert({
          residence_id: invitation.residence_id,
          user_id: params.userId,
          role: "staff",
          invited_by: invitation.invited_by,
          invitation_status: "accepted",
          is_active: true,
          permissions: initialPermissions,
        });
        membershipError = error;
      }
    }
    if (membershipError) {
      console.error("[team] accept membership write failed:", membershipError.code, membershipError.message);
      // Se devuelve la invitación para que pueda reintentar con el mismo enlace.
      await admin
        .from("residence_team_invitations")
        .update({ status: "pending", accepted_at: null, accepted_by_user_id: null })
        .eq("id", invitation.id)
        .eq("status", "accepted");
      return { ok: false, code: "failed", error: GENERIC_ERROR };
    }

    // Recuento DESPUÉS de escribir el vínculo: dos aceptaciones simultáneas pasan el chequeo previo. Si quedó por encima del tope, se
    // desactiva el vínculo recién creado y la invitación vuelve a `pending` (podrá reintentar cuando haya lugar).
    if (!alreadyMember) {
      const { data: staffAfter, error: staffAfterError } = await admin
        .from("residence_users")
        .select("user_id")
        .eq("residence_id", invitation.residence_id)
        .eq("role", "staff")
        .eq("is_active", true);
      if (staffAfterError || (staffAfter ?? []).length > MAX_STAFF_PER_RESIDENCE) {
        if (staffAfterError) console.error("[team] accept staff recount failed:", staffAfterError.code, staffAfterError.message);
        await admin
          .from("residence_users")
          .update({ is_active: false })
          .eq("residence_id", invitation.residence_id)
          .eq("user_id", params.userId)
          .eq("role", "staff");
        await admin
          .from("residence_team_invitations")
          .update({ status: "pending", accepted_at: null, accepted_by_user_id: null })
          .eq("id", invitation.id)
          .eq("status", "accepted");
        return { ok: false, code: "failed", error: staffAfterError ? GENERIC_ERROR : TEAM_FULL_ON_ACCEPT_MESSAGE };
      }
    }

    await createAuditLog(admin, {
      actorUserId: params.userId,
      actorRole: "residence_staff",
      action: "team_invitation_accepted",
      entityType: "residence_team_invitations",
      entityId: invitation.id,
      newValue: { residence_id: invitation.residence_id, role: "staff", already_member: alreadyMember, ...(alreadyMember ? {} : { permissions: initialPermissions }) },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
    // Aviso al dueño (in-app + email genérico), best-effort.
    await notifyResidenceTeam(admin, { residenceId: invitation.residence_id, event: "team_member_joined", entityId: invitation.residence_id });

    return { ok: true, residenceId: invitation.residence_id, alreadyMember };
  } catch (error) {
    console.error("[team] accept failed:", error);
    return { ok: false, code: "failed", error: GENERIC_ERROR };
  }
}
