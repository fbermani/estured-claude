import type { FounderPlace } from "@/lib/preapertura/rules";

/**
 * Mail de confirmación de la solicitud de alta de una residencia (borrador `registro-residencia-exito.html`, vista «Email»). Módulo PURO
 * para testearlo. Todo dato escrito por la persona se escapa: va dentro de HTML. Sin planes, precios ni comisión; sin plazos prometidos.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Asunto seguro: sin saltos de línea ni caracteres de control (evita inyectar encabezados) y con el nombre acotado a 80 caracteres. */
export function safeSubjectName(name: string, max = 80): string {
  const clean = name.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

const BOX = "margin:16px 0;padding:12px 14px;background:#f3faf6;border-radius:12px;color:#1d2722;font-size:15px";

function founderBox(place: FounderPlace): string {
  if (place === "cupo") {
    return `<div style="${BOX}"><b>Residencias fundadoras:</b> tu solicitud ocupa uno de los 10 lugares mientras avanzamos. Si la residencia queda verificada, al abrir lleva la insignia «Residencia fundadora» y el Plan Premium bonificado.</div>`;
  }
  if (place === "lleno") {
    return `<div style="${BOX}"><b>Residencias fundadoras:</b> hoy los 10 lugares están en proceso. Si alguno se libera, te avisamos.</div>`;
  }
  return "";
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
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d2722;line-height:1.55">
<p style="font-size:20px;font-weight:700;margin:0 0 16px">EstuRed</p>
<p>Hola${greeting ? `, ${greeting}` : ""}:</p>
<p>Recibimos la solicitud para sumar <b>${residence}</b> (${escapeHtml(input.address)}) a EstuRed. ¡Gracias!</p>
<ol style="padding-left:20px"><li>Te escribimos por mail o WhatsApp.</li><li>Coordinamos una charla y una visita.</li><li>Después de la visita, te damos tu cuenta.</li></ol>
${founderBox(input.place)}
<p>Sumar tu residencia es gratis. Si algún dato quedó mal, respondé este mail.</p>
<p>Saludos,<br>El equipo de EstuRed</p>
<p style="margin-top:24px;padding-top:12px;border-top:1px solid #e8e0d2;font-size:13px;color:#6b756f">Recibiste este mail porque se pidió sumar una residencia a EstuRed con esta dirección. Si no fuiste vos, respondé a ${escapeHtml(input.contactEmail)} y borramos los datos.</p>
</div>`;
  return { subject: `Recibimos la solicitud de ${safeSubjectName(input.residenceName)}`, html };
}
