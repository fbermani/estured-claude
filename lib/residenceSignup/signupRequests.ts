import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { generateInvitationToken, hashInvitationToken, isPlausibleInvitationToken } from "@/lib/team/invitationToken";
import {
  canGenerateInvite,
  canTransition,
  inviteExpiry,
  inviteState,
  isSignupStatus,
  type InviteState,
  type SignupInput,
  type SignupStatus,
} from "@/lib/residenceSignup/rules";

/** Acceso a `residence_signup_requests` (migración 0066, DR22). Solo service role: la tabla no tiene policies. */

export type SignupRequestRow = {
  id: string;
  created_at: string;
  residence_name: string;
  neighborhood: string;
  contact_name: string;
  email: string;
  phone: string;
  instagram_or_web: string | null;
  approx_beds: number | null;
  status: SignupStatus;
  admin_notes: string | null;
  email_confirmed_at: string | null;
  contacted_at: string | null;
  visit_at: string | null;
  handled_by: string | null;
  invite_expires_at: string | null;
  invite_used_at: string | null;
  residence_id: string | null;
};

const COLUMNS =
  "id, created_at, residence_name, neighborhood, contact_name, email, phone, instagram_or_web, approx_beds, status, admin_notes, email_confirmed_at, contacted_at, visit_at, handled_by, invite_expires_at, invite_used_at, residence_id";

type Actor = { actorUserId: string; actorRole: string };

/** Alta pública. Duplicado activo (23505) = éxito: no se le dice a nadie que ya existía. */
export async function createSignupRequest(admin: SupabaseClient, input: SignupInput): Promise<{ ok: true } | { ok: false; unavailable: boolean }> {
  const { error } = await admin.from("residence_signup_requests").insert({ ...input, source: "web" });
  if (error) {
    if (error.code === "23505") return { ok: true };
    if (!isMissingSchemaError(error)) console.error("[residence-signup] insert failed:", error.message);
    return { ok: false, unavailable: isMissingSchemaError(error) };
  }
  return { ok: true };
}

export async function listSignupRequests(
  admin: SupabaseClient,
  filter: SignupStatus | "active" | "all",
): Promise<{ ok: true; rows: SignupRequestRow[] } | { ok: false; missingSchema: boolean }> {
  let query = admin.from("residence_signup_requests").select(COLUMNS).order("created_at", { ascending: true }).limit(500);
  if (filter === "active") query = query.in("status", ["received", "in_contact", "visit_scheduled"]);
  else if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query;
  if (error) {
    const missingSchema = isMissingSchemaError(error);
    if (!missingSchema) console.error("[residence-signup] list failed:", error.message);
    return { ok: false, missingSchema };
  }
  return { ok: true, rows: (data ?? []) as SignupRequestRow[] };
}

type RowResult = { ok: true; row: SignupRequestRow } | { ok: false; error: string };

/** Distingue «no existe» de un fallo de la base. */
async function getRow(admin: SupabaseClient, id: string): Promise<RowResult> {
  const { data, error } = await admin.from("residence_signup_requests").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("[residence-signup] getRow failed:", error.message);
    return { ok: false, error: "No pudimos leer la solicitud. Probá de nuevo." };
  }
  if (!data) return { ok: false, error: "No encontramos la solicitud." };
  return { ok: true, row: data as SignupRequestRow };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Cambio de estado manual validado contra las transiciones. */
export async function changeSignupStatus(
  admin: SupabaseClient,
  params: Actor & { id: string; to: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(params.id) || !isSignupStatus(params.to)) return { ok: false, error: "Solicitud o estado inválido." };
  const found = await getRow(admin, params.id);
  if (!found.ok) return found;
  const row = found.row;
  if (!canTransition(row.status, params.to)) return { ok: false, error: "Ese cambio de estado no está permitido desde el estado actual." };

  const patch: Record<string, unknown> = { status: params.to, handled_by: params.actorUserId };
  if (params.to === "in_contact" && !row.contacted_at) patch.contacted_at = new Date().toISOString();
  if (params.to === "discarded") {
    // Un descarte invalida cualquier enlace pendiente.
    patch.invite_token_hash = null;
    patch.invite_expires_at = null;
  }
  // Condición sobre el estado leído: si otro admin la movió en el medio, no pisa.
  const { data, error } = await admin.from("residence_signup_requests").update(patch).eq("id", row.id).eq("status", row.status).select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos actualizar la solicitud. Recargá la página e intentá de nuevo." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "residence_signup_status_changed",
    entityType: "residence_signup_requests",
    entityId: row.id,
    oldValue: { status: row.status },
    newValue: { status: params.to },
    source: "admin",
  });
  return { ok: true };
}

/**
 * Notas, email, fecha de visita y ficha borrador (opcional, interna: E4). `visitAt` es ISO o null. Si el email cambia se resetea su
 * confirmación. La ficha elegida no puede tener usuarios ni estar publicada (`verified_active`). El update exige que la solicitud
 * siga abierta (condición en la misma sentencia). La verificación de la ficha y el update no son una transacción: si otro proceso
 * le suma usuarios en el medio, el canje igual lo rechaza (revisa `residence_users` antes de vincular).
 */
export async function saveSignupDetails(
  admin: SupabaseClient,
  params: Actor & { id: string; notes: string; email: string; visitAt: string | null; draftResidenceId: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(params.id)) return { ok: false, error: "Solicitud inválida." };
  if (params.notes.length > 4000) return { ok: false, error: "Las notas son demasiado largas (hasta 4000 caracteres)." };
  const email = params.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: "Revisá el email: no parece válido." };
  const found = await getRow(admin, params.id);
  if (!found.ok) return found;
  const row = found.row;
  if (row.status === "account_delivered" || row.status === "discarded") return { ok: false, error: "La solicitud ya está cerrada." };
  if (params.draftResidenceId) {
    if (!isUuid(params.draftResidenceId)) return { ok: false, error: "El ID de la ficha borrador no es válido." };
    const { data: residence, error: resError } = await admin.from("residences").select("id, status").eq("id", params.draftResidenceId).maybeSingle();
    if (resError) return { ok: false, error: "No pudimos verificar la ficha. Probá de nuevo." };
    if (!residence) return { ok: false, error: "No existe una residencia con ese ID." };
    if (residence.status === "verified_active") return { ok: false, error: "Esa ficha ya está publicada: elegí una ficha borrador." };
    const { count, error: usersError } = await admin.from("residence_users").select("*", { count: "exact", head: true }).eq("residence_id", params.draftResidenceId);
    if (usersError) return { ok: false, error: "No pudimos verificar la ficha. Probá de nuevo." };
    if ((count ?? 0) > 0) return { ok: false, error: "Esa ficha ya tiene usuarios: elegí otra." };
  }
  const emailChanged = email !== row.email.trim().toLowerCase();
  const { data, error } = await admin
    .from("residence_signup_requests")
    .update({
      admin_notes: params.notes || null,
      email,
      ...(emailChanged ? { email_confirmed_at: null } : {}),
      visit_at: params.visitAt,
      residence_id: params.draftResidenceId,
      handled_by: params.actorUserId,
    })
    .eq("id", row.id)
    .not("status", "in", "(account_delivered,discarded)")
    .select("id");
  if (error) {
    // 23505: ya hay otra solicitud activa con ese email y nombre de residencia.
    return { ok: false, error: error.code === "23505" ? "Ya hay otra solicitud activa con ese email y esa residencia." : "No pudimos guardar los cambios." };
  }
  if (!data?.length) return { ok: false, error: "La solicitud ya está cerrada." };
  return { ok: true };
}

/** El admin confirma que el email es de la residencia (lo verificó al contactarla). Requisito para generar la invitación. */
export async function confirmSignupEmail(admin: SupabaseClient, params: Actor & { id: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(params.id)) return { ok: false, error: "Solicitud inválida." };
  const { data, error } = await admin
    .from("residence_signup_requests")
    .update({ email_confirmed_at: new Date().toISOString(), handled_by: params.actorUserId })
    .eq("id", params.id)
    .not("status", "in", "(account_delivered,discarded)")
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos confirmar el email. Recargá la página e intentá de nuevo." };
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "residence_signup_email_confirmed",
    entityType: "residence_signup_requests",
    entityId: params.id,
    source: "admin",
  });
  return { ok: true };
}

/**
 * Genera la invitación: token aleatorio, se guarda SOLO su SHA-256 y el vencimiento. Devuelve el token en claro para mostrarlo una vez.
 * Generar otra invalida la anterior (el hash se reemplaza). El sistema no envía nada: la entrega la hace el admin a mano.
 */
export async function generateSignupInvite(
  admin: SupabaseClient,
  params: Actor & { id: string },
): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  if (!isUuid(params.id)) return { ok: false, error: "Solicitud inválida." };
  const found = await getRow(admin, params.id);
  if (!found.ok) return found;
  const row = found.row;
  if (!canGenerateInvite(row.status, row.invite_used_at, row.email_confirmed_at)) {
    return { ok: false, error: "Para generar la invitación la visita tiene que estar coordinada y el email confirmado con la residencia." };
  }
  const { token, hash } = generateInvitationToken();
  const expiresAt = inviteExpiry().toISOString();
  const { data, error } = await admin
    .from("residence_signup_requests")
    .update({ invite_token_hash: hash, invite_expires_at: expiresAt, handled_by: params.actorUserId })
    .eq("id", row.id)
    .eq("status", "visit_scheduled")
    .eq("email", row.email)
    .not("email_confirmed_at", "is", null)
    .is("invite_used_at", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos generar la invitación. Probá de nuevo." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "residence_signup_invite_generated",
    entityType: "residence_signup_requests",
    entityId: row.id,
    newValue: { invite_expires_at: expiresAt }, // nunca el token ni su hash
    source: "admin",
  });
  return { ok: true, token, expiresAt };
}

// ---- Canje ----

export type PeekedInvite = { state: InviteState; request?: SignupRequestRow };

/** Busca la solicitud por hash del token y evalúa el enlace. Nunca devuelve la fila si no es válido. */
export async function peekSignupInvite(admin: SupabaseClient, token: string): Promise<PeekedInvite> {
  if (!isPlausibleInvitationToken(token)) return { state: "invalid" };
  const { data } = await admin.from("residence_signup_requests").select(COLUMNS).eq("invite_token_hash", hashInvitationToken(token)).maybeSingle();
  const row = (data as SignupRequestRow | null) ?? null;
  // Si el admin cambió el email después de generar el enlace, la confirmación se reseteó y el enlace deja de valer.
  const state = row && !row.email_confirmed_at ? "invalid" : inviteState(row);
  return state === "valid" && row ? { state, request: row } : { state };
}

/**
 * Reclama el enlace de forma atómica (un solo uso): marca `invite_used_at` solo si sigue sin usar, vigente y en `visit_scheduled`.
 * Si dos pestañas lo canjean a la vez, solo una gana.
 */
export async function claimSignupInvite(admin: SupabaseClient, requestId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("residence_signup_requests")
    .update({ invite_used_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "visit_scheduled")
    .is("invite_used_at", null)
    .not("email_confirmed_at", "is", null)
    .gt("invite_expires_at", new Date().toISOString())
    .select("id");
  return !error && !!data?.length;
}

/** Deshace el reclamo cuando la creación de la cuenta falló: vuelve a `visit_scheduled` y restituye la ficha original. */
export async function releaseSignupInvite(admin: SupabaseClient, requestId: string, originalResidenceId: string | null): Promise<void> {
  const { error } = await admin
    .from("residence_signup_requests")
    .update({ invite_used_at: null, status: "visit_scheduled", residence_id: originalResidenceId })
    .eq("id", requestId);
  if (error) console.error("[residence-signup] release failed:", error.message);
}

/** Cierra el alta. Exige `visit_scheduled` en el mismo update; devuelve `false` si no se pudo (el llamador revierte). */
export async function markSignupAccountDelivered(admin: SupabaseClient, requestId: string, residenceId: string, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("residence_signup_requests")
    .update({ status: "account_delivered", residence_id: residenceId })
    .eq("id", requestId)
    .eq("status", "visit_scheduled")
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("[residence-signup] markDelivered failed:", error.message);
    return false;
  }
  await createAuditLog(admin, {
    actorUserId: userId,
    actorRole: "residence_owner",
    action: "residence_signup_account_delivered",
    entityType: "residence_signup_requests",
    entityId: requestId,
    newValue: { residence_id: residenceId },
  });
  return true;
}

export { isMissingSchemaError };
