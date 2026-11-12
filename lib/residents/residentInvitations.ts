import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sendEmail";
import { assertResidencePermission } from "@/lib/residences/access";
import { generateInvitationToken } from "@/lib/team/invitationToken";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { buildPersonalInviteMessage, buildResidentInviteEmail, buildResidentInviteWhatsappUrl } from "@/lib/residents/inviteMessage";
import {
  evaluateInvite,
  inviteExpiry,
  inviteSenderName,
  replyToFromContact,
  type InviteChannel,
  type InviteState,
} from "@/lib/residents/inviteRules";
import { emailBelongsToUnguardedMinor } from "@/lib/residents/studentLinkGuards";
import { getAppUrl } from "@/lib/appUrl";

/**
 * Invitación personal a un residente ya cargado (DR19, lado residencia). Permiso `residents.manage`. Una sola invitación abierta por
 * estadía: emitir una nueva revoca la anterior. El token en claro solo existe en el enlace que se devuelve/envía; en la base queda el hash.
 */

const NOT_AVAILABLE = "Las invitaciones personales todavía no están disponibles en este entorno. Avisá a Soporte.";
const GENERIC = "No pudimos preparar la invitación. Intentá de nuevo.";
const RESEND_COOLDOWN_MS = 60_000;

function appUrl(): string {
  return getAppUrl();
}
export function personalInviteLink(token: string): string {
  return `${appUrl()}/register/student?invite=${token}`;
}

export type IssueInviteResult =
  | { ok: true; link: string; emailSent: boolean; whatsappUrl: string | null }
  | { ok: false; error: string };

export async function issueResidentInvite(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    residentStayId: string;
    channel: Extract<InviteChannel, "email" | "whatsapp">;
    /** `email`: manda el mail. `whatsapp`: solo devuelve el enlace y la URL wa.me (envío manual). */
    now?: Date;
    /** Al corregir el mail: el reenvío inmediato no cuenta como abuso. */
    skipCooldown?: boolean;
  },
): Promise<IssueInviteResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };
  const now = params.now ?? new Date();

  const { data: stay, error: stayError } = await admin
    .from("resident_stays")
    .select("id, invite_email, invite_name, invite_phone, student_profile_id, is_current, status")
    .eq("id", params.residentStayId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (stayError) {
    console.error("[residents] issueResidentInvite stay read failed:", stayError);
    return { ok: false, error: GENERIC };
  }
  if (!stay) return { ok: false, error: "Ese residente no pertenece a esta residencia." };
  if (!stay.is_current || stay.student_profile_id) return { ok: false, error: "Este residente ya tiene su cuenta vinculada o su estadía terminó." };
  if (params.channel === "email" && !stay.invite_email) return { ok: false, error: "Este residente no tiene mail cargado. Cargalo o compartí el enlace por WhatsApp." };

  if (stay.invite_email && (await emailBelongsToUnguardedMinor(admin, stay.invite_email as string))) {
    return { ok: false, error: "Esta persona es menor de 18: para invitarla necesita antes un familiar o tutor vinculado en EstuRed." };
  }

  // Cooldown de reenvío por estadía (evita bombardear un mail).
  const { data: previous, error: previousError } = await admin
    .from("resident_stay_invitations")
    .select("id, sent_at")
    .eq("resident_stay_id", params.residentStayId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (previousError) {
    if (isMissingSchemaError(previousError)) return { ok: false, error: NOT_AVAILABLE };
    console.error("[residents] issueResidentInvite previous read failed:", previousError);
    return { ok: false, error: GENERIC };
  }
  const last = previous?.[0] as { sent_at: string | null } | undefined;
  if (params.channel === "email" && !params.skipCooldown && last?.sent_at && now.getTime() - new Date(last.sent_at).getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Ya mandamos la invitación hace un momento. Esperá un minuto antes de reenviarla." };
  }

  const { token, hash } = generateInvitationToken();
  const revoke = await admin
    .from("resident_stay_invitations")
    .update({ revoked_at: now.toISOString(), revoke_reason: "replaced" })
    .eq("resident_stay_id", params.residentStayId)
    .is("used_at", null)
    .is("revoked_at", null);
  if (revoke.error && !isMissingSchemaError(revoke.error)) {
    console.error("[residents] issueResidentInvite revoke failed:", revoke.error);
    return { ok: false, error: GENERIC };
  }
  const { data: created, error: insertError } = await admin
    .from("resident_stay_invitations")
    .insert({
      resident_stay_id: params.residentStayId,
      residence_id: params.residenceId,
      token_hash: hash,
      channel: params.channel,
      created_by: params.actorUserId,
      expires_at: inviteExpiry(now).toISOString(),
    })
    .select("id")
    .single();
  if (insertError || !created) {
    if (insertError && isMissingSchemaError(insertError)) return { ok: false, error: NOT_AVAILABLE };
    console.error("[residents] issueResidentInvite insert failed:", insertError);
    return { ok: false, error: GENERIC };
  }

  const link = personalInviteLink(token);
  const { data: residence } = await admin.from("residences").select("name").eq("id", params.residenceId).maybeSingle();
  const residenceName = ((residence as { name?: string } | null)?.name ?? "Tu residencia").toString();
  let emailSent = false;
  let whatsappUrl: string | null = null;

  if (params.channel === "email") {
    const { data: priv } = await admin.from("residence_private_details").select("responsible_contact").eq("residence_id", params.residenceId).maybeSingle();
    const firstName = String(stay.invite_name ?? "").trim().split(" ")[0] || null;
    const mail = buildResidentInviteEmail({ residenceName, firstName, link });
    emailSent = await sendEmail({
      to: stay.invite_email as string,
      subject: mail.subject,
      html: mail.html,
      fromName: inviteSenderName(residenceName),
      replyTo: replyToFromContact((priv as { responsible_contact?: string | null } | null)?.responsible_contact) ?? undefined,
    });
    if (emailSent) {
      await admin
        .from("resident_stay_invitations")
        .update({ sent_at: now.toISOString(), send_count: 1 })
        .eq("id", (created as { id: string }).id);
    }
  } else {
    whatsappUrl = buildResidentInviteWhatsappUrl(buildPersonalInviteMessage({ residenceName, link }), (stay.invite_phone as string | null) ?? null);
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: params.channel === "email" ? "resident_invite_emailed" : "resident_invite_link_generated",
    entityType: "resident_stays",
    entityId: params.residentStayId,
    // PII mínima: ni el mail, ni el teléfono, ni el token.
    newValue: { residence_id: params.residenceId, channel: params.channel, email_sent: emailSent },
  });

  return { ok: true, link, emailSent, whatsappUrl };
}

export type InviteStatus = { state: InviteState | "none"; channel: InviteChannel | null; sentAt: string | null };

/** Estado de la última invitación de cada estadía, para la lista de la residencia. Tolerante a la 0064 sin aplicar (todo «none»). */
export async function loadInviteStatusByStay(admin: SupabaseClient, stayIds: string[], now: Date = new Date()): Promise<Map<string, InviteStatus>> {
  const out = new Map<string, InviteStatus>();
  if (stayIds.length === 0) return out;
  const { data, error } = await admin
    .from("resident_stay_invitations")
    .select("resident_stay_id, channel, expires_at, used_at, revoked_at, declined_at, sent_at, created_at")
    .in("resident_stay_id", stayIds)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[residents] loadInviteStatusByStay failed:", error);
    return out;
  }
  for (const row of (data ?? []) as {
    resident_stay_id: string;
    channel: InviteChannel;
    expires_at: string;
    used_at: string | null;
    revoked_at: string | null;
    declined_at: string | null;
    sent_at: string | null;
  }[]) {
    if (out.has(row.resident_stay_id)) continue; // la primera es la más nueva
    out.set(row.resident_stay_id, { state: evaluateInvite(row, now), channel: row.channel, sentAt: row.sent_at });
  }
  return out;
}
