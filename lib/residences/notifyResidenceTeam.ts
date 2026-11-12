import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { sendEmail } from "@/lib/email/sendEmail";
import { rowCan, type ResidencePermission } from "@/lib/residences/permissions";
import { getAppUrl } from "@/lib/appUrl";

/**
 * Avisos al equipo de la residencia (owner + staff activos) en el loop central (Ciclo 63, docs/07: "notificar a la
 * residencia: Nueva solicitud recibida"). In-app + email, best-effort: nunca lanza ni tumba la acción que lo generó.
 *
 * El texto es deliberadamente genérico (sin nombre del estudiante ni datos personales: el email viaja por un tercero)
 * y no promete disponibilidad. El detalle se ve al entrar con el enlace.
 */
export type ResidenceTeamEvent = "new_application" | "new_waitlist_entry" | "new_renewal_request"
  | "changes_requested"
  | "verification_approved"
  | "verification_rejected"
  | "verification_expiring"
  | "team_member_joined"
  | "custom_amenity_approved"
  | "custom_amenity_rejected"
  | "new_resident_link_request"
  | "new_room_change_request"
  | "room_change_place_matched";

/**
 * DR10: estos avisos van SOLO al dueño. El staff no puede actuar sobre ellos (la verificación y el equipo son del dueño),
 * así que recibirlos solo le generaría ruido o expectativas que no puede cumplir. El resto va a todo el equipo activo.
 */
export const OWNER_ONLY_EVENTS: ReadonlySet<ResidenceTeamEvent> = new Set<ResidenceTeamEvent>([
  "changes_requested",
  "verification_approved",
  "verification_rejected",
  "verification_expiring",
  "team_member_joined",
]);

/**
 * DR11: los avisos del día a día van al dueño y al staff que tiene el permiso para actuar sobre ellos (el staff sin el permiso solo
 * generaría ruido). Los eventos de `OWNER_ONLY_EVENTS` no figuran acá: van solo al dueño.
 */
export const PERMISSION_BY_EVENT: Partial<Record<ResidenceTeamEvent, ResidencePermission>> = {
  new_application: "applications.review_contact",
  new_waitlist_entry: "waitlist.manage",
  new_renewal_request: "renewals.manage",
  // DR18: el staff que puede editar el perfil se entera de qué pasó con los ítems «Otro» que propuso.
  custom_amenity_approved: "profile.edit",
  custom_amenity_rejected: "profile.edit",
  // DR19: un estudiante alojado pide vincularse a la residencia; lo resuelve quien tiene `residents.manage`.
  new_resident_link_request: "residents.manage",
  // DR34: pedidos de cambio de habitación y plazas liberadas que coinciden con uno; los resuelve quien tiene `residents.manage`.
  new_room_change_request: "residents.manage",
  room_change_place_matched: "residents.manage",
};

const ENTITY_BY_EVENT: Record<ResidenceTeamEvent, string> = {
  new_application: "application_requests",
  new_waitlist_entry: "waitlist_entries",
  new_renewal_request: "renewal_requests",
  // Ciclo 66: el destino de la campana es el Panel (`notificationHref` área residencia, entidad `residences`).
  changes_requested: "residences",
  verification_approved: "residences",
  verification_rejected: "residences",
  verification_expiring: "residences",
  // Ciclo 73 (DR10): el destino de la campana es la pantalla Equipo (`notificationHref`, entidad `residence_team`, id = residencia).
  team_member_joined: "residence_team",
  custom_amenity_approved: "residences",
  custom_amenity_rejected: "residences",
  new_resident_link_request: "residences",
  new_room_change_request: "room_change_requests",
  room_change_place_matched: "room_change_place_alerts",
};

function pathFor(event: ResidenceTeamEvent, residenceId: string, entityId: string): string {
  switch (event) {
    case "new_application":
      return `/residence/${residenceId}/applications/${entityId}`;
    case "new_waitlist_entry":
      return `/residence/${residenceId}/waitlist`;
    case "new_renewal_request":
      return `/residence/${residenceId}/renewals`;
    case "changes_requested":
    case "verification_approved":
    case "verification_rejected":
    case "verification_expiring":
      return `/residence/${residenceId}`;
    case "team_member_joined":
      return `/residence/${residenceId}/team`;
    case "custom_amenity_approved":
    case "custom_amenity_rejected":
      return `/residence/${residenceId}/profile`;
    case "new_resident_link_request":
      return `/residence/${residenceId}/residents`;
    case "new_room_change_request":
    case "room_change_place_matched":
      return `/residence/${residenceId}/residents?filtro=cambio-habitacion`;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Copy del aviso (puro, testeable). `path` es relativo a la app; el email le antepone la URL base. */
export function buildResidenceTeamMessage(
  event: ResidenceTeamEvent,
  residenceName: string,
): { title: string; body: string; subject: string; intro: string; cta: string } {
  switch (event) {
    case "new_application":
      return {
        title: `Tenés una solicitud nueva en ${residenceName}`,
        body: "Revisala y respondé dentro del plazo. La solicitud está sujeta a confirmación de tu parte.",
        subject: "EstuRed: tenés una solicitud nueva",
        intro: `Tenés una solicitud nueva en ${residenceName}.`,
        cta: "Ver la solicitud",
      };
    case "new_waitlist_entry":
      return {
        title: `Alguien se anotó en la lista de espera de ${residenceName}`,
        body: "Anotarse en la lista no implica disponibilidad: lo ves en la sección Lista de espera.",
        subject: "EstuRed: nueva persona en tu lista de espera",
        intro: `Alguien se anotó en la lista de espera de ${residenceName}.`,
        cta: "Ver la lista de espera",
      };
    case "new_renewal_request":
      return {
        title: `Un residente pidió renovar en ${residenceName}`,
        body: "Podés responder con una oferta desde la sección Renovaciones.",
        subject: "EstuRed: nuevo pedido de renovación",
        intro: `Un residente pidió renovar su estadía en ${residenceName}.`,
        cta: "Ver renovaciones",
      };
    case "new_resident_link_request":
      return {
        title: `Un estudiante pidió vincularse a ${residenceName}`,
        body: "Revisá la solicitud en Residentes: nada se vincula hasta que la apruebes.",
        subject: "EstuRed: solicitud de vínculo de un residente",
        intro: `Alguien dice vivir en ${residenceName} y pidió vincular su cuenta. Nada se vincula hasta que lo apruebes.`,
        cta: "Ver solicitudes de vínculo",
      };
    // DR34: sin nombre ni preferencia del residente (el email viaja por un tercero); el detalle se ve en Residentes. No promete disponibilidad.
    case "new_room_change_request":
      return {
        title: `Un residente pidió cambiar de habitación en ${residenceName}`,
        body: "Revisá el pedido en Residentes. Queda sujeto a la disponibilidad de la residencia.",
        subject: "EstuRed: un residente pidió cambiar de habitación",
        intro: `Un residente de ${residenceName} pidió cambiar de habitación. Quedó anotado en Residentes, sujeto a la disponibilidad de la residencia.`,
        cta: "Ver el pedido",
      };
    case "room_change_place_matched":
      return {
        title: `Se liberó una plaza que busca un residente de ${residenceName}`,
        body: "Todavía no la publicamos como disponible. Elegí si se la ofrecés a ese residente, la ignorás o la publicás.",
        subject: "EstuRed: se liberó una plaza que busca un residente",
        intro: `Se liberó una plaza de ${residenceName} que coincide con el pedido de un residente. Todavía no la publicamos como disponible: elegí qué hacer desde Residentes.`,
        cta: "Decidir qué hacer",
      };
    case "changes_requested":
      // Ciclo 66 (DR5): sin el mensaje del admin (el email viaja por un tercero); el detalle se ve en el panel.
      return {
        title: `Pedimos cambios en tu perfil de ${residenceName}`,
        body: "Entrá a tu panel para ver qué corregir y reenviarlo.",
        subject: "EstuRed: pedimos cambios en tu perfil",
        intro: `Pedimos cambios en tu perfil de ${residenceName}. Entrá a tu panel para ver qué corregir y reenviarlo.`,
        cta: "Ir a mi panel",
      };
    // Ciclo 70 (DR7): sin motivos ni datos sensibles (el email viaja por un tercero) y sin plazos inventados.
    case "verification_approved":
      return {
        title: `Aprobamos la verificación de ${residenceName}`,
        body: "Tu residencia ya está publicada en el catálogo de EstuRed. Entrá a tu panel para ver cómo sigue.",
        subject: "EstuRed: aprobamos la verificación de tu residencia",
        intro: `Aprobamos la verificación de ${residenceName}. Tu residencia ya está publicada en el catálogo de EstuRed.`,
        cta: "Ir a mi panel",
      };
    case "verification_rejected":
      return {
        title: `La verificación de ${residenceName} no fue aprobada`,
        body: "Tu residencia no está publicada. Para conocer el motivo y los pasos a seguir, escribinos por Soporte.",
        subject: "EstuRed: la verificación de tu residencia no fue aprobada",
        intro: `La verificación de ${residenceName} no fue aprobada y la residencia no está publicada. Para conocer el motivo y los pasos a seguir, escribinos por Soporte.`,
        cta: "Ir a mi panel",
      };
    case "verification_expiring":
      return {
        title: `La verificación de ${residenceName} vence pronto`,
        body: "Vence en menos de 30 días. Cuando venza vas a poder reenviarla para revisión desde tu panel y el equipo de EstuRed coordina la nueva visita.",
        subject: "EstuRed: la verificación de tu residencia vence pronto",
        intro: `La verificación de ${residenceName} vence en menos de 30 días. Cuando venza vas a poder reenviarla para revisión desde tu panel y el equipo de EstuRed coordina la nueva visita.`,
        cta: "Ir a mi panel",
      };
    // Ciclo 73 (DR10): sin el email ni datos de la persona (el email viaja por un tercero); el detalle se ve en la pantalla Equipo.
    case "team_member_joined":
      return {
        title: `Alguien aceptó tu invitación al equipo de ${residenceName}`,
        body: "Ya puede trabajar en la residencia con acceso de staff. Mirá quién forma parte del equipo en la sección Equipo.",
        subject: "EstuRed: aceptaron tu invitación al equipo",
        intro: `Alguien aceptó tu invitación al equipo de ${residenceName} y ya tiene acceso de staff.`,
        cta: "Ver el equipo",
      };
    // DR18: sin el texto del ítem ni el motivo (el email viaja por un tercero); el detalle se ve en la ficha de la residencia.
    case "custom_amenity_approved":
      return {
        title: `Aprobamos un ítem propio de ${residenceName}`,
        body: "Ya se muestra en tu ficha pública junto a los servicios o áreas comunes de la lista.",
        subject: "EstuRed: aprobamos un ítem de tu ficha",
        intro: `Aprobamos un ítem propio que sumaste a la ficha de ${residenceName}. Ya se muestra en tu ficha pública.`,
        cta: "Ver la ficha",
      };
    case "custom_amenity_rejected":
      return {
        title: `No pudimos aprobar un ítem propio de ${residenceName}`,
        body: "Entrá a la configuración de tu residencia para ver el motivo y, si querés, corregirlo.",
        subject: "EstuRed: no pudimos aprobar un ítem de tu ficha",
        intro: `No pudimos aprobar un ítem propio que sumaste a la ficha de ${residenceName}. Entrá a la configuración para ver el motivo.`,
        cta: "Ver el motivo",
      };
  }
}

/**
 * Quiénes reciben el evento según su rol y sus permisos en la residencia (DR10/DR11): los avisos del dueño no van al staff; los del día
 * a día van al dueño y al staff con el permiso correspondiente (sin `permissions` guardado, falla cerrado: no recibe).
 */
export function filterTeamByEvent<T extends { user_id: string; role?: string | null; permissions?: unknown }>(event: ResidenceTeamEvent, rows: T[]): T[] {
  if (OWNER_ONLY_EVENTS.has(event)) return rows.filter((r) => r.role === "owner");
  const permission = PERMISSION_BY_EVENT[event];
  if (!permission) return rows.filter((r) => r.role === "owner");
  return rows.filter((r) => rowCan(r, permission));
}

/** Destinatarios: usuarios activos y no bloqueados, sin repetir. El email es opcional (solo se manda si existe). */
export function pickTeamRecipients(
  users: { id: string; email: string | null; is_active: boolean | null; is_blocked: boolean | null }[],
): { id: string; email: string | null }[] {
  const seen = new Set<string>();
  const out: { id: string; email: string | null }[] = [];
  for (const u of users) {
    if (!u.is_active || u.is_blocked || seen.has(u.id)) continue;
    seen.add(u.id);
    out.push({ id: u.id, email: u.email || null });
  }
  return out;
}

export async function notifyResidenceTeam(
  admin: SupabaseClient,
  params: { residenceId: string; event: ResidenceTeamEvent; entityId: string },
): Promise<void> {
  try {
    const [{ data: residence }, { data: teamRows }] = await Promise.all([
      admin.from("residences").select("name").eq("id", params.residenceId).maybeSingle(),
      admin.from("residence_users").select("user_id, role, permissions").eq("residence_id", params.residenceId).eq("is_active", true),
    ]);
    const targetRows = filterTeamByEvent(params.event, (teamRows ?? []) as { user_id: string; role: string | null; permissions: unknown }[]);
    const userIds = [...new Set(targetRows.map((r) => r.user_id))];
    if (userIds.length === 0) return;

    const { data: users } = await admin.from("users").select("id, email, is_active, is_blocked").in("id", userIds);
    const recipients = pickTeamRecipients(users ?? []);
    if (recipients.length === 0) return;

    const copy = buildResidenceTeamMessage(params.event, residence?.name ?? "tu residencia");
    const appUrl = getAppUrl();
    const link = `${appUrl}${pathFor(params.event, params.residenceId, params.entityId)}`;

    await Promise.all(
      recipients.flatMap((r) => [
        createNotification(admin, {
          userId: r.id,
          title: copy.title,
          body: copy.body,
          relatedEntityType: ENTITY_BY_EVENT[params.event],
          relatedEntityId: params.entityId,
        }),
        r.email
          ? sendEmail({
              to: r.email,
              subject: copy.subject,
              html: `<p>Hola,</p><p>${escapeHtml(copy.intro)}</p><p><a href="${link}">${copy.cta}</a></p>`,
            })
          : Promise.resolve(),
      ]),
    );
  } catch (error) {
    console.error("[residences] notifyResidenceTeam failed:", error);
  }
}
