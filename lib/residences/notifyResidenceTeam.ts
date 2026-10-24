import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { sendEmail } from "@/lib/email/sendEmail";

/**
 * Avisos al equipo de la residencia (owner + staff activos) en el loop central (Ciclo 63, docs/07: "notificar a la
 * residencia: Nueva solicitud recibida"). In-app + email, best-effort: nunca lanza ni tumba la acción que lo generó.
 *
 * El texto es deliberadamente genérico (sin nombre del estudiante ni datos personales: el email viaja por un tercero)
 * y no promete disponibilidad. El detalle se ve al entrar con el enlace.
 */
export type ResidenceTeamEvent = "new_application" | "new_waitlist_entry" | "new_renewal_request";

const ENTITY_BY_EVENT: Record<ResidenceTeamEvent, string> = {
  new_application: "application_requests",
  new_waitlist_entry: "waitlist_entries",
  new_renewal_request: "renewal_requests",
};

function pathFor(event: ResidenceTeamEvent, residenceId: string, entityId: string): string {
  switch (event) {
    case "new_application":
      return `/residence/${residenceId}/applications/${entityId}`;
    case "new_waitlist_entry":
      return `/residence/${residenceId}/waitlist`;
    case "new_renewal_request":
      return `/residence/${residenceId}/renewals`;
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
  }
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
      admin.from("residence_users").select("user_id").eq("residence_id", params.residenceId).eq("is_active", true),
    ]);
    const userIds = [...new Set((teamRows ?? []).map((r) => r.user_id as string))];
    if (userIds.length === 0) return;

    const { data: users } = await admin.from("users").select("id, email, is_active, is_blocked").in("id", userIds);
    const recipients = pickTeamRecipients(users ?? []);
    if (recipients.length === 0) return;

    const copy = buildResidenceTeamMessage(params.event, residence?.name ?? "tu residencia");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
