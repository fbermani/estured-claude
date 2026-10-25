import "server-only";
import { Resend } from "resend";

const FROM_ADDRESS = "EstuRed <onboarding@resend.dev>";

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
export async function sendEmail(entry: { to: string; subject: string; html: string }): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.error("[email] RESEND_API_KEY no configurada — email no enviado:", entry.subject);
    return false;
  }
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: entry.to,
    subject: entry.subject,
    html: entry.html,
  });
  if (error) {
    console.error("[email] envío falló:", error.name, error.message, entry.subject);
    return false;
  }
  return true;
}
