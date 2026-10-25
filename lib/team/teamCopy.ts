/**
 * Textos del equipo de la residencia (DR10). Puro y testeable. Los emails viajan por un tercero (Resend): son genéricos, nombran la
 * residencia (dato público de su ficha) y NO incluyen datos del dueño, de otras personas ni plazos que prometan nada.
 */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Largo máximo del nombre de la residencia dentro del email (el nombre lo carga la residencia: se acota para que no domine el mensaje). */
export const MAX_RESIDENCE_NAME_IN_EMAIL = 60;

export function truncateResidenceName(name: string, max: number = MAX_RESIDENCE_NAME_IN_EMAIL): string {
  const clean = name.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** El asunto es fijo y NO nombra la residencia (ni nada que cargue el dueño): el nombre va solo en el cuerpo, acotado. */
export const INVITATION_EMAIL_SUBJECT = "Te invitaron a sumarte a un equipo en EstuRed";

export function buildInvitationEmail(params: { residenceName: string; link: string; expiresInDays: number }): {
  subject: string;
  html: string;
} {
  const name = escapeHtml(truncateResidenceName(params.residenceName));
  return {
    subject: INVITATION_EMAIL_SUBJECT,
    html: `
      <p>Hola,</p>
      <p>Te invitaron a sumarte al equipo de <strong>${name}</strong> en EstuRed para ayudar con el día a día de la residencia.</p>
      <p><a href="${params.link}">Aceptar la invitación</a></p>
      <p>El enlace es personal, se puede usar una sola vez y vence en ${params.expiresInDays} días. Si no esperabas este mensaje, ignoralo: no pasa nada.</p>
    `,
  };
}

export const INVITE_SENT_MESSAGE = (email: string) => `Le enviamos la invitación a ${email}.`;
/** La invitación quedó creada pero el email no salió (sin proveedor configurado o error del proveedor). */
export const INVITE_EMAIL_FAILED_MESSAGE = "Creamos la invitación pero no pudimos enviar el email. Podés reenviarla.";
/** Reenviar sin que el email salga: no se cambió nada, el enlace anterior sigue funcionando. */
export const RESEND_EMAIL_FAILED_MESSAGE =
  "No pudimos enviar el email, así que la invitación quedó como estaba (el enlace anterior sigue funcionando). Probá reenviarla de nuevo en unos minutos.";
/** Sin la columna de permisos iniciales en la invitación (0051 sin la versión con permisos): solo se puede invitar con los valores por defecto. */
export const PERMISSIONS_UNAVAILABLE_MESSAGE =
  "Todavía no podemos guardar permisos personalizados al invitar. Probá con los permisos por defecto y ajustalos después de que acepte, o escribinos por Soporte.";
export const PERMISSIONS_SAVED_MESSAGE = (email: string) => `Guardamos los permisos de ${email}.`;
/** Los permisos efectivos cambiaron entre que se abrió el panel y se guardó (otra pestaña u otro dueño): no se guarda nada. */
export const PERMISSIONS_STALE_MESSAGE = "Los permisos cambiaron mientras editabas. Recargá la página.";
export const PERMISSIONS_UNCHANGED_MESSAGE = "No hay cambios para guardar.";

/** Aviso in-app genérico al staff cuando el dueño le cambia los permisos (no detalla cuáles ni cuenta nada del dueño). */
export const PERMISSIONS_CHANGED_NOTICE = (residenceName: string) => ({
  title: `El dueño actualizó tus permisos en ${truncateResidenceName(residenceName)}`,
  body: "Podés ver qué podés hacer hoy en el Panel de la residencia, en \"Tus permisos\".",
});

export const INVITE_RESENT_MESSAGE = (email: string) => `Reenviamos la invitación a ${email}. El enlace anterior ya no funciona.`;

export const MEMBER_REMOVED_NOTICE = (residenceName: string) => ({
  title: `Ya no tenés acceso a ${residenceName}`,
  body: "El dueño de la residencia te quitó el acceso al equipo. Si creés que fue un error, hablá con él.",
});
