import { CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/constants/contact";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Plantilla común de los mails. Módulo PURO. HTML para clientes de correo: tablas y estilos en línea.
 * Colores = tokens de `app/globals.css` (el correo no lee variables CSS). Las imágenes son PNG de `public/email/`
 * (las genera `scripts/generate-email-images.mjs`), con URL absoluta. El mail se entiende sin ellas.
 */
export const EMAIL_IMAGES = {
  mark: "marca.png",
  fundadora: "fundadora.png",
  invitacion: "invitacion.png",
  cuenta: "cuenta.png",
  bienvenida: "bienvenida.png",
  habitacion: "habitacion.png",
  instagram: "instagram.png",
} as const;

export type EmailHero = Exclude<keyof typeof EMAIL_IMAGES, "mark" | "habitacion" | "instagram">;

/** URL absoluta de una imagen de `public/email/`. */
export function emailImageUrl(key: keyof typeof EMAIL_IMAGES, siteUrl: string = SITE_URL): string {
  return `${siteUrl.replace(/\/+$/, "")}/email/${EMAIL_IMAGES[key]}`;
}

export const EMAIL_COLORS = {
  ink: "#1d2722",
  inkSoft: "#44524b",
  inkFaint: "#5f6c65",
  line: "#e8e0d2",
  cream: "#fbf6ec",
  cream2: "#f4ecdc",
  paper: "#fffdf8",
  forest: "#1f7d5c",
  forest700: "#0f4d39",
  forestInk: "#0c3a2c",
  forestTint: "#e2f1ea",
  orange: "#c0521d",
  gold: "#e9b84b",
  butter: "#fbeec3",
} as const;

const C = EMAIL_COLORS;
const FONT = "font-family:Arial,Helvetica,sans-serif";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Párrafo del cuerpo. `html` ya viene escapado por quien lo arma. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 14px">${html}</p>`;
}

/** Botón principal (uno por mail). El fondo va en la celda para que se vea también en Outlook. */
export function emailButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td bgcolor="${C.orange}" style="border-radius:999px">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;${FONT};font-size:16px;font-weight:700;color:${C.paper};text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Invitación a seguir el Instagram: va en todos los mails (pedido del dueño, 2026-11-27). */
export function instagramBlock(siteUrl: string = SITE_URL): string {
  // El SVG no se ve en Gmail: el ícono es un PNG y va dentro del link, junto al usuario.
  const icon = `<img src="${emailImageUrl("instagram", siteUrl)}" width="20" height="20" alt="" style="vertical-align:-4px;border:0;margin-right:6px">`;
  return `<p style="margin:0 0 14px;${FONT};font-size:15px;line-height:1.5;color:${C.ink}">Seguinos en Instagram: <a href="${INSTAGRAM_URL}" style="color:${C.orange};font-weight:700;white-space:nowrap">${icon}${INSTAGRAM_HANDLE}</a></p>`;
}

export function renderEmail(input: {
  /** Resumen que la bandeja muestra junto al asunto. */
  preheader: string;
  title: string;
  hero: EmailHero;
  /** HTML ya escapado. */
  bodyHtml: string;
  /** Por qué llegó el mail y qué hacer si no se esperaba (texto plano). */
  footerNote: string;
  /** Origen de las imágenes; por defecto, el sitio configurado. */
  siteUrl?: string;
}): string {
  const image = (key: keyof typeof EMAIL_IMAGES) => emailImageUrl(key, input.siteUrl);
  const link = `color:${C.forest700};font-weight:700`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.paper};border:1px solid ${C.line};border-radius:16px;overflow:hidden">
<tr><td style="padding:14px 28px;background:${C.forestInk}">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px;vertical-align:middle"><img src="${image("mark")}" width="34" height="35" alt="" style="display:block;border:0"></td>
<td style="vertical-align:middle;${FONT};font-size:22px;font-weight:700;color:${C.paper}">EstuRed</td>
</tr></table>
</td></tr>
<tr><td style="line-height:0;background:${C.cream2}"><img src="${image(input.hero)}" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:28px 28px 14px;${FONT};font-size:16px;line-height:1.55;color:${C.ink}">
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:${C.ink}">${escapeHtml(input.title)}</h1>
${input.bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid ${C.line};${FONT};font-size:13px;line-height:1.55;color:${C.inkFaint}">
${instagramBlock(input.siteUrl)}
<p style="margin:0 0 10px">${escapeHtml(input.footerNote)}</p>
<p style="margin:0"><a href="mailto:${CONTACT_EMAIL}" style="${link}">${CONTACT_EMAIL}</a><br>EstuRed &middot; Residencias estudiantiles en Buenos Aires</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}
