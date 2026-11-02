/**
 * Mensaje pre-armado para avisar la llegada por WhatsApp (DR29). SOLO botón manual: «Copiar mensaje» / «Abrir WhatsApp»
 * (`wa.me` con texto). Nunca la API de WhatsApp Business. No promete disponibilidad ni garantías.
 */

export function buildArrivalMessage(input: { residenceName: string; startDateLabel: string; daysLeft: number }): string {
  const when = input.daysLeft === 0 ? "hoy" : input.daysLeft === 1 ? "mañana" : `el ${input.startDateLabel}`;
  return `¡Hola! Te cuento que mi ingreso a ${input.residenceName} está previsto para ${when}. Voy preparando todo desde EstuRed. Cualquier novedad te aviso.`;
}

/** Enlace `wa.me` sin número (el usuario elige el contacto) con el texto codificado. */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
