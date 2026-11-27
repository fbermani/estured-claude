import { EMAIL_COLORS as C, emailParagraph, escapeHtml, renderEmail } from "@/lib/email/layout";
import { FOUNDER_CAPACITY, type FounderPlace } from "@/lib/preapertura/rules";

export { escapeHtml };

/**
 * Mail de confirmación de la solicitud de alta de una residencia (borrador `registro-residencia-exito.html`, vista «Email»). Módulo PURO
 * para testearlo. Todo dato escrito por la persona se escapa: va dentro de HTML. Sin planes, precios ni comisión; sin plazos prometidos.
 */
/** Asunto seguro: sin saltos de línea ni caracteres de control (evita inyectar encabezados) y con el nombre acotado a 80 caracteres. */
export function safeSubjectName(name: string, max = 80): string {
  const clean = name.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

function box(background: string, border: string, text: string): string {
  return `<div style="margin:4px 0 18px;padding:14px 16px;background:${background};border-left:4px solid ${border};border-radius:12px;font-size:15px">${text}</div>`;
}

function founderBox(place: FounderPlace): string {
  if (place === "cupo") {
    return box(C.butter, C.gold, `<b>Residencias fundadoras:</b> tu solicitud ocupa uno de los ${FOUNDER_CAPACITY} lugares mientras avanzamos. Si la residencia queda verificada, al abrir lleva la insignia «Residencia fundadora» y el Plan Premium bonificado.`);
  }
  if (place === "lleno") {
    return box(C.cream2, C.line, `<b>Residencias fundadoras:</b> hoy los ${FOUNDER_CAPACITY} lugares están en proceso. Si alguno se libera, te avisamos.`);
  }
  return "";
}

const STEPS = ["Te escribimos por mail o WhatsApp.", "Coordinamos una charla y una visita.", "Después de la visita, te damos tu cuenta."] as const;

function steps(): string {
  const rows = STEPS.map(
    (step, i) =>
      `<tr><td width="40" style="vertical-align:top;padding:0 0 10px"><div style="width:28px;height:28px;line-height:28px;border-radius:999px;background:${C.forestTint};color:${C.forest700};font-weight:700;font-size:14px;text-align:center">${i + 1}</div></td><td style="vertical-align:top;padding:3px 0 10px">${step}</td></tr>`,
  ).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${rows}</table>`;
}

export function buildResidenceConfirmationEmail(input: {
  contactName: string;
  residenceName: string;
  address: string;
  place: FounderPlace;
  contactEmail: string;
}): { subject: string; html: string } {
  const residence = escapeHtml(input.residenceName);
  const greeting = escapeHtml(firstName(input.contactName));
  const bodyHtml = [
    emailParagraph(`Hola${greeting ? `, ${greeting}` : ""}:`),
    emailParagraph(`Recibimos la solicitud para sumar <b>${residence}</b> (${escapeHtml(input.address)}) a EstuRed. ¡Gracias!`),
    steps(),
    founderBox(input.place),
    emailParagraph("Sumar tu residencia es gratis. Si algún dato quedó mal, respondé este mail."),
    emailParagraph("Saludos,<br>El equipo de EstuRed"),
  ].join("\n");
  const html = renderEmail({
    preheader: "Te escribimos para conocerte y coordinar una visita.",
    title: "¡Recibimos tu solicitud!",
    hero: "fundadora",
    bodyHtml,
    footerNote: `Recibiste este mail porque se pidió sumar una residencia a EstuRed con esta dirección. Si no fuiste vos, respondé a ${input.contactEmail} y borramos los datos.`,
  });
  return { subject: `Recibimos la solicitud de ${safeSubjectName(input.residenceName)}`, html };
}
