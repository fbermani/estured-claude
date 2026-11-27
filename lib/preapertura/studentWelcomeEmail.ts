import { CONTACT_EMAIL } from "@/lib/constants/contact";
import { EMAIL_COLORS as C, emailButton, emailParagraph, escapeHtml, renderEmail } from "@/lib/email/layout";

/**
 * Mail de bienvenida al estudiante de la preapertura (DR67 (j)). Módulo PURO. Explica para qué sirve el perfil y la comunidad con lo
 * que ya dicen los Términos de la preapertura: no agrega funciones, plazos ni promesas. El menor invitado (14 a 17) recibe otra
 * versión: su perfil no aparece en la comunidad y su búsqueda no se muestra a residencias.
 */
function heading(text: string): string {
  return `<h2 style="margin:22px 0 10px;font-size:19px;line-height:1.3;color:${C.ink}">${text}</h2>`;
}

function checks(items: readonly string[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td width="28" style="vertical-align:top;padding:0 0 8px;font-weight:700;color:${C.forest}">&#10003;</td><td style="vertical-align:top;padding:0 0 8px">${item}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${rows}</table>`;
}

function numberBox(registrationNumber: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 6px"><tr><td align="center" bgcolor="${C.forestInk}" style="padding:16px;border-radius:12px;color:${C.paper}">Tu número de registro<br><span style="font-size:44px;line-height:1.2;font-weight:700;color:${C.gold}">${escapeHtml(String(registrationNumber))}</span><br><span style="font-size:13px">No da prioridad para conseguir un lugar.</span></td></tr></table>`;
}

const ADULT_PROFILE_USES = [
  "Armamos tu búsqueda: tipo de habitación, mes de ingreso y universidad.",
  "Las residencias verificadas la ven sin tu nombre ni contacto.",
  "Si una se interesa, vos decidís si le pasamos tu nombre y email.",
  "La residencia donde vivís hoy nunca la ve.",
] as const;

function community(): string {
  return [
    heading("La comunidad"),
    emailParagraph("Cuando abramos, vas a poder ver quiénes viven en cada residencia antes de elegir. Cada estudiante decide qué mostrar."),
    `<div style="margin:0 0 18px;padding:14px 16px;background:${C.butter};border-left:4px solid ${C.gold};border-radius:12px;font-size:15px"><b>Hoy ya podés aparecer en la comunidad de la web. Es opcional.</b><br>Si la activás en tu perfil, tu tarjeta muestra nombre sin apellido, edad, país, carrera, hábitos e intereses. Cualquiera puede verla. Nunca muestra tu apellido, contacto ni dónde vivís. La quitás cuando quieras desde tu perfil.</div>`,
  ].join("\n");
}

export function buildStudentWelcomeEmail(input: {
  isMinor: boolean;
  /** `null` si todavía no hay número guardado (migración 0111 sin aplicar): el mail no lo menciona. */
  registrationNumber: number | null;
  profileUrl: string;
}): { subject: string; html: string } {
  const bodyHtml = [
    emailParagraph("Hola:"),
    emailParagraph("Creaste tu cuenta en EstuRed. Todavía no abrimos: te avisamos por mail."),
    input.registrationNumber == null ? "" : numberBox(input.registrationNumber),
    heading("Completá tu perfil"),
    emailParagraph("Lo necesitamos para mostrarte residencias que te sirvan."),
    input.isMinor
      ? emailParagraph("Por tu edad, tu perfil no aparece en la comunidad y tu búsqueda no se muestra a residencias.")
      : checks(ADULT_PROFILE_USES),
    input.isMinor ? "" : community(),
    emailButton(input.profileUrl, "Completar mi perfil"),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    subject: "¡Listo! Ya estás en EstuRed",
    html: renderEmail({
      preheader: "Completá tu perfil. Te avisamos por mail cuando abramos.",
      title: "¡Ya estás adentro!",
      hero: "bienvenida",
      bodyHtml,
      footerNote: `Recibiste este mail porque se creó una cuenta en EstuRed con esta dirección. Si no fuiste vos, escribinos a ${CONTACT_EMAIL} y borramos los datos.`,
    }),
  };
}
