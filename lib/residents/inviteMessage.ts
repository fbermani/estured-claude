import { escapeHtml, truncateResidenceName } from "@/lib/team/teamCopy";
import { INVITE_TTL_DAYS, OTP_TTL_MINUTES } from "@/lib/residents/inviteConstants";

/**
 * Mensaje modelo para invitar a los residentes a crear su cuenta en EstuRed (DR18 punto 20).
 * Envío MANUAL por la residencia: solo se arma un enlace wa.me (sin elegir destinatario, así
 * funciona para un grupo o un contacto). Nunca se usa la API de WhatsApp Business.
 */
export function buildResidentInviteMessage(params: { residenceName: string; registerUrl: string }): string {
  const name = params.residenceName.trim() || "tu residencia";
  return [
    `¡Hola! Te escribimos de ${name}.`,
    "Estamos ordenando las habitaciones y los contratos en EstuRed. Para eso necesitamos que crees tu cuenta con el mismo email que nos diste y confirmes ese mail con un código que te llega; así tu perfil queda vinculado a tu estadía.",
    `Registrate acá (te lleva un minuto): ${params.registerUrl}`,
    "Cualquier duda, escribinos por acá.",
  ].join("\n\n");
}

/** Con `phone` (solo dígitos, con código de país) abre el chat con esa persona; sin teléfono, el selector de WhatsApp. Siempre manual. */
export function buildResidentInviteWhatsappUrl(message: string, phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${/^[0-9]{8,15}$/.test(digits) ? digits : ""}?text=${encodeURIComponent(message)}`;
}

/**
 * Mensaje de WhatsApp con el ENLACE PERSONAL del residente (DR19). Se envía a mano (wa.me): nunca por la API de WhatsApp Business.
 * El enlace es de un solo uso y vence; el mensaje no promete nada más que eso.
 */
export function buildPersonalInviteMessage(params: { residenceName: string; link: string }): string {
  const name = truncateResidenceName(params.residenceName) || "tu residencia";
  return [
    `¡Hola! Te escribimos de ${name}.`,
    "Armamos tu perfil de residente en EstuRed. Entrá con este enlace personal (es solo para vos y vale una vez, por " + INVITE_TTL_DAYS + " días) para crear tu cuenta o activar tu estadía:",
    params.link,
    "Si no vivís acá o no sos vos, avisanos desde el mismo enlace.",
  ].join("\n\n");
}

/** Mail de invitación personal. Viaja por un tercero (Resend): nombra la residencia (dato público), no incluye datos de otras personas. */
export function buildResidentInviteEmail(params: { residenceName: string; firstName?: string | null; link: string }): { subject: string; html: string } {
  const name = escapeHtml(truncateResidenceName(params.residenceName) || "Tu residencia");
  const hello = params.firstName ? `Hola ${escapeHtml(params.firstName)},` : "Hola,";
  return {
    subject: "Activá tu estadía en EstuRed",
    html: `
      <p>${hello}</p>
      <p><strong>${name}</strong> armó tu perfil de residente en EstuRed. Con el botón de abajo creás tu cuenta (o ingresás con la que ya tenés) y tu estadía queda vinculada.</p>
      <p><a href="${params.link}">Activar mi estadía</a></p>
      <p>El enlace es personal, se usa una sola vez y vence en ${INVITE_TTL_DAYS} días. Si no vivís ahí o no sos vos, podés avisarlo desde el mismo enlace. Si no esperabas este mensaje, ignoralo: no pasa nada.</p>
      <p>Este mensaje lo envía EstuRed en nombre de la residencia; si respondés, le llega a ella.</p>
    `,
  };
}

/** Mail con el código de verificación. Sin nombres de personas ni de residencias. */
export function buildOtpEmail(code: string): { subject: string; html: string } {
  return {
    subject: "Tu código de verificación de EstuRed",
    html: `
      <p>Hola,</p>
      <p>Tu código para activar tu estadía en EstuRed es:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px">${escapeHtml(code)}</p>
      <p>Vale ${OTP_TTL_MINUTES} minutos. Si no lo pediste vos, ignoralo y no se lo pases a nadie.</p>
    `,
  };
}
