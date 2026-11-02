import "server-only";
import { Resend } from "resend";

/** TODO de producción (GAPS.md): dominio verificado. Hasta entonces Resend sandbox solo entrega al dueño de la cuenta. */
const FROM_EMAIL = "onboarding@resend.dev";
const FROM_ADDRESS = `EstuRed <${FROM_EMAIL}>`;

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
 * `FROM_ADDRESS` usa el remitente sandbox de Resend porque el proyecto
 * todavía no tiene un dominio propio verificado — en ese modo, Resend
 * SOLO entrega al email con el que se creó la cuenta, no a destinatarios
 * reales. Cambiar a un remitente del dominio propio (`no-reply@estured.com`
 * o similar) es lo único que hace falta cuando el dominio exista — no
 * hay que tocar los call sites.
 */
const SAFE_ADDRESS = /^[^\s@<>,;"\\\u0000-\u001f]+@[^\s@<>,;"\\\u0000-\u001f]+\.[^\s@<>,;"\\\u0000-\u001f]+$/;
/** Dirección simple (sin nombre, listas ni caracteres de control): evita inyección de encabezados y envíos a varios destinatarios. */
export function sanitizeAddress(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 && v.length <= 254 && SAFE_ADDRESS.test(v) ? v : null;
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
    from: entry.fromName ? `${entry.fromName.replace(/[<>"\r\n]/g, " ")} <${FROM_EMAIL}>` : FROM_ADDRESS,
    ...(replyTo ? { replyTo } : {}),
    to,
    subject: entry.subject,
    html: entry.html,
  });
  if (error) {
    console.error("[email] envío falló:", error.name, error.message);
    return false;
  }
  return true;
}
