import "server-only";
import { Resend } from "resend";
import { INSTAGRAM_URL } from "@/lib/constants/contact";
import { instagramBlock } from "@/lib/email/layout";

/**
 * Remitente. Producción: definir `EMAIL_FROM` con una dirección de un dominio verificado en Resend (p. ej.
 * `no-reply@tudominio.com`, solo la dirección, sin nombre). Sin esa variable (o si es inválida) se usa el sandbox de
 * Resend, que solo entrega al dueño de la cuenta (GAPS.md: dominio verificado).
 */
const SANDBOX_FROM_EMAIL = "onboarding@resend.dev";
function fromEmail(): string {
  const configured = (process.env.EMAIL_FROM ?? "").trim();
  return sanitizeAddress(configured) ?? SANDBOX_FROM_EMAIL;
}

let client: Resend | null = null;
function getClient(): Resend | null {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  client = new Resend(apiKey);
  return client;
}

/**
 * Proveedor de email (docs/00 §29, Resend — Ciclo 34unodevicies-quater).
 * Devuelve `true` si el proveedor aceptó el envío y `false` si no salió (sin API key o error del proveedor): los call sites que no lo
 * necesitan lo ignoran (compatibilidad hacia atrás); el equipo de la residencia lo usa para avisarle al dueño (DR10).
 * Nunca lanza, mismo criterio que `createNotification`/`createAuditLog`:
 * un email que falla no debe poder tumbar la acción de negocio que lo
 * generó — el in-app queda como respaldo mínimo garantizado.
 *
 * Mientras `EMAIL_FROM` no esté definido se usa el remitente sandbox de Resend:
 * en ese modo Resend SOLO entrega al email con el que se creó la cuenta, no a
 * destinatarios reales. Al tener dominio verificado alcanza con definir
 * `EMAIL_FROM` — no hay que tocar los call sites.
 */
const SAFE_ADDRESS = /^[^\s@<>,;"\\\u0000-\u001f]+@[^\s@<>,;"\\\u0000-\u001f]+\.[^\s@<>,;"\\\u0000-\u001f]+$/;
/** Dirección simple (sin nombre, listas ni caracteres de control): evita inyección de encabezados y envíos a varios destinatarios. */
export function sanitizeAddress(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 && v.length <= 254 && SAFE_ADDRESS.test(v) ? v : null;
}

/** ¿Hay proveedor de mail configurado (clave de Resend)? No dice si el dominio está verificado: solo evita flujos que dependen de un mail que no puede salir. */
export function isEmailProviderConfigured(): boolean {
  return (process.env.RESEND_API_KEY ?? "").trim().length > 0;
}

/** Suma el Instagram a los mails que no usan la plantilla común (que ya lo trae). */
export function withInstagram(html: string): string {
  if (html.includes(INSTAGRAM_URL)) return html;
  const block = instagramBlock();
  return html.includes("</body>") ? html.replace("</body>", () => `${block}</body>`) : `${html}${block}`;
}

export async function sendEmail(entry: {
  to: string;
  subject: string;
  html: string;
  /** Nombre visible del remitente (p. ej. «Residencia X te invita, vía EstuRed»). La dirección SIEMPRE es la de EstuRed, nunca la de un tercero. */
  fromName?: string;
  /** Dirección a la que llegan las respuestas (p. ej. el contacto de la residencia). */
  replyTo?: string;
}): Promise<boolean> {
  const to = sanitizeAddress(entry.to);
  if (!to) {
    console.error("[email] destinatario inválido — email no enviado");
    return false;
  }
  const replyTo = entry.replyTo ? sanitizeAddress(entry.replyTo) : null;
  const resend = getClient();
  if (!resend) {
    console.error("[email] RESEND_API_KEY no configurada — email no enviado");
    return false;
  }
  const { error } = await resend.emails.send({
    from: `${entry.fromName ? entry.fromName.replace(/[<>"\r\n]/g, " ") : "EstuRed"} <${fromEmail()}>`,
    ...(replyTo ? { replyTo } : {}),
    to,
    subject: entry.subject,
    html: withInstagram(entry.html),
  });
  if (error) {
    console.error("[email] envío falló:", error.name, error.message);
    return false;
  }
  return true;
}
