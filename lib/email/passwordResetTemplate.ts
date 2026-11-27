import { emailButton, emailParagraph, renderEmail } from "@/lib/email/layout";

/**
 * Plantilla «Reset Password» de Supabase Auth. NO la manda la app: se pega en el panel de Supabase
 * (Authentication → Email Templates), que reemplaza `{{ .ConfirmationURL }}`. La copia lista para pegar es
 * `docs/mail/recuperar-contrasena.html`; el test la mantiene igual a lo que arma este módulo.
 */
export const PASSWORD_RESET_SUBJECT = "Cambiá tu contraseña de EstuRed";

export function buildPasswordResetTemplate(): string {
  const confirmationUrl = "{{ .ConfirmationURL }}";
  return renderEmail({
    siteUrl: "https://estured.com",
    preheader: "Elegí una contraseña nueva.",
    title: "Cambiá tu contraseña",
    hero: "cuenta",
    bodyHtml: [
      emailParagraph("Hola:"),
      emailParagraph("Pediste cambiar tu contraseña. Tocá el botón para elegir una nueva."),
      emailButton(confirmationUrl, "Elegir contraseña nueva"),
      emailParagraph("El link sirve una sola vez."),
    ].join("\n"),
    footerNote: "Si no lo pediste, ignorá este mail. Tu contraseña no cambia.",
  });
}
