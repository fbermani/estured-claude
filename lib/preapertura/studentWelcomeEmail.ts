import { CONTACT_EMAIL } from "@/lib/constants/contact";
import { EMAIL_COLORS as C, emailButton, emailImageUrl, emailParagraph, escapeHtml, renderEmail } from "@/lib/email/layout";

/**
 * Mail de bienvenida al estudiante de la preapertura (DR67 (j)). Módulo PURO. Cuenta por qué reservar por EstuRed y une el perfil con
 * la comunidad. Solo menciona funciones que la app tiene (pedido del dueño, 2026-11-27): nada de residencias mirando búsquedas. La
 * habitación es un recorte de la captura de la landing, con datos de ejemplo y así rotulado. Al menor invitado (14 a 17) no se le
 * ofrece aparecer en la comunidad.
 */
const FIRST_TO_CHOOSE = "¡Serás de los primeros en poder elegir una residencia verificada!";

const REASONS: ReadonlyArray<readonly [string, string]> = [
  ["Residencias verificadas en persona.", "Las visitamos antes de publicarlas."],
  ["Todo a la vista antes de elegir.", "Precios, reglas y quiénes viven ahí."],
  ["Comprobante de reserva.", "Cuando validamos tu pago, recibís uno con código y QR."],
  ["Soporte.", "Si algo importante no coincide con lo publicado, abrís un caso de Soporte."],
];

function heading(text: string): string {
  return `<h2 style="margin:24px 0 10px;font-size:20px;line-height:1.3;color:${C.ink}">${text}</h2>`;
}

function reasons(): string {
  const rows = REASONS.map(
    ([title, text]) =>
      `<tr><td width="28" style="vertical-align:top;padding:0 0 10px;font-weight:700;color:${C.forest}">&#10003;</td><td style="vertical-align:top;padding:0 0 10px"><b>${title}</b><br>${text}</td></tr>`,
  ).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px">${rows}</table>`;
}

function highlight(registrationNumber: number | null): string {
  const number =
    registrationNumber == null
      ? ""
      : `Tu número de registro<br><span style="font-size:44px;line-height:1.2;font-weight:700;color:${C.gold}">${escapeHtml(String(registrationNumber))}</span><br>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 6px"><tr><td align="center" bgcolor="${C.forestInk}" style="padding:16px;border-radius:12px;color:${C.paper}">${number}<b>${FIRST_TO_CHOOSE}</b></td></tr></table>`;
}

function room(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px"><tr><td align="center">
<img src="${emailImageUrl("habitacion")}" width="300" alt="Ejemplo de una habitación doble: dos estudiantes con su nombre, edad, país y carrera." style="display:block;width:100%;max-width:300px;height:auto;border:0">
<p style="margin:6px 0 0;font-size:12px;color:${C.inkFaint}">Así se ve una habitación en la app, con datos de ejemplo.</p>
</td></tr></table>`;
}

const PUBLIC_CARD = `<div style="margin:0 0 18px;padding:14px 16px;background:${C.butter};border-left:4px solid ${C.gold};border-radius:12px;font-size:15px"><b>Podés aparecer desde hoy en la comunidad de la web. Es opcional.</b><br>Tu tarjeta muestra nombre sin apellido, edad, país, carrera, hábitos e intereses. Cualquiera puede verla. Nunca muestra tu apellido, contacto ni dónde vivís. La quitás cuando quieras desde tu perfil.</div>`;

export function buildStudentWelcomeEmail(input: {
  isMinor: boolean;
  /** `null` si todavía no hay número guardado (migración 0111 sin aplicar): el mail no lo menciona. */
  registrationNumber: number | null;
  profileUrl: string;
}): { subject: string; html: string } {
  const bodyHtml = [
    emailParagraph("Hola:"),
    emailParagraph("Creaste tu cuenta en EstuRed. Todavía no abrimos: te avisamos por mail y por WhatsApp."),
    highlight(input.registrationNumber),
    heading("¿Por qué EstuRed?"),
    emailParagraph(`Cuando abramos, <b style="color:${C.forest700}">reservar por EstuRed te da más que reservar por fuera</b>:`),
    reasons(),
    heading(input.isMinor ? "Completá tu perfil" : "Completá tu perfil y sumate a la comunidad"),
    emailParagraph("Con tu perfil completo, vas a tener más chances de reservar tu residencia elegida."),
    emailParagraph("En la comunidad vas a ver quiénes viven en cada residencia antes de elegir."),
    room(),
    input.isMinor ? emailParagraph("Por tu edad, tu perfil no aparece en la comunidad.") : PUBLIC_CARD,
    emailButton(input.profileUrl, "Completar mi perfil"),
  ].join("\n");
  return {
    subject: "¡Listo! Ya estás en EstuRed",
    html: renderEmail({
      preheader: FIRST_TO_CHOOSE,
      title: "¡Ya estás adentro!",
      hero: "bienvenida",
      bodyHtml,
      footerNote: `Recibiste este mail porque se creó una cuenta en EstuRed con esta dirección. Si no fuiste vos, escribinos a ${CONTACT_EMAIL} y borramos los datos.`,
    }),
  };
}
