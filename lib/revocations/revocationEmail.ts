import { escapeHtml } from "@/lib/residenceSignup/confirmationEmail";
import { REVOCATION_EMAIL_SUBJECT, revocationTrackingCode } from "@/lib/revocations/copy";

/**
 * DR65 (b): email que confirma el arrepentimiento del fee con su código de seguimiento. Función pura (sin envío) para testearla.
 * No incluye montos, datos bancarios ni el motivo que escribió quien revocó.
 */
export function buildRevocationEmail(input: {
  reservationId: string;
  residenceName: string | null;
  revokedAtIso: string;
  firstName: string | null;
}): { subject: string; html: string; trackingCode: string } {
  const trackingCode = revocationTrackingCode(input.reservationId);
  const day = new Date(input.revokedAtIso).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const greeting = input.firstName?.trim() ? `, ${escapeHtml(input.firstName.trim())}` : "";
  const where = input.residenceName ? ` de tu reserva en <b>${escapeHtml(input.residenceName)}</b>` : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d2722;line-height:1.55">
<p style="font-size:20px;font-weight:700;margin:0 0 16px">EstuRed</p>
<p>Hola${greeting}:</p>
<p>Registramos el arrepentimiento del fee de EstuRed${where} el ${day}.</p>
<p>Tu código de seguimiento es <b style="font-size:18px;letter-spacing:1px">${trackingCode}</b>.</p>
<p>Tu reserva quedó cancelada. Te reintegramos el fee completo por transferencia y te avisamos cuando esté hecho. Lo que pagaste a la residencia se acuerda con la residencia.</p>
<p>Podés ver el estado en «Botón de arrepentimiento», al pie del sitio.</p>
<p style="font-size:12px;color:#5b665f">Recibís este email porque tenés una cuenta o un trámite en EstuRed. No enviamos publicidad.</p>
</div>`;
  return { subject: REVOCATION_EMAIL_SUBJECT, html, trackingCode };
}
