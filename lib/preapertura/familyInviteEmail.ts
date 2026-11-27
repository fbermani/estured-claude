import { BENEFITS } from "@/components/preapertura/BenefitList";
import { EMAIL_COLORS as C, emailButton, emailParagraph, escapeHtml, renderEmail } from "@/lib/email/layout";

/**
 * Mail que invita al hijo/a a la preapertura (DR43.2). Módulo PURO. Sin promesas de disponibilidad ni de reserva.
 * Los beneficios son los del popup (DR67 i), fuente única.
 */
export function buildFamilyInviteEmail(input: { inviteUrl: string }): { subject: string; html: string } {
  const url = escapeHtml(input.inviteUrl);
  const benefits = BENEFITS.map(
    (b) =>
      `<tr><td style="padding:10px 14px;background:${C.forestTint};border-radius:12px;font-weight:700;color:${C.forest700}">&#10003;&nbsp; ${escapeHtml(b.label)}</td></tr><tr><td style="height:8px;line-height:8px">&nbsp;</td></tr>`,
  ).join("");
  const bodyHtml = [
    emailParagraph("Hola:"),
    emailParagraph("Un familiar te invitó a sumarte a EstuRed, la plataforma para encontrar residencias estudiantiles verificadas en Buenos Aires."),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px">${benefits}</table>`,
    emailParagraph("Todavía no abrimos. Sumate gratis y enterate primero cuando abramos."),
    emailButton(input.inviteUrl, "Sumarme gratis"),
    `<p style="margin:0 0 14px;font-size:13px;color:${C.inkFaint};word-break:break-all">Si el botón no funciona, copiá este link: <a href="${url}" style="color:${C.forest700}">${url}</a></p>`,
  ].join("\n");
  return {
    subject: "Te invitaron a sumarte a EstuRed",
    html: renderEmail({
      preheader: "Un familiar quiere que conozcas EstuRed. Sumarte es gratis.",
      title: "Te invitaron a EstuRed",
      hero: "invitacion",
      bodyHtml,
      footerNote: "Si no esperabas este mensaje, ignoralo.",
    }),
  };
}
