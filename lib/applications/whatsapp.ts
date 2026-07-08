/**
 * Botón de WhatsApp pre-formateado (docs/07 §15.3, docs/00 y docs/11:
 * PROHIBIDA cualquier integración de la API de WhatsApp Business — esto
 * es únicamente un link `wa.me` que abre una conversación manual).
 */
export function buildWhatsappUrl(params: {
  phone: string;
  studentName: string;
  residenceName: string;
  roomTypeName: string;
  desiredStartDate: string;
  durationMonths: number;
  reservationAmountUsd: number;
}): string {
  const digits = params.phone.replace(/[^0-9]/g, "");
  const message =
    `Hola! Te escribo por la solicitud de reserva en EstuRed.\n` +
    `Estudiante: ${params.studentName}\n` +
    `Residencia: ${params.residenceName}\n` +
    `Tipo de habitación: ${params.roomTypeName}\n` +
    `Fecha de ingreso deseada: ${params.desiredStartDate}\n` +
    `Duración: ${params.durationMonths} meses\n` +
    `Monto para reservar: USD ${params.reservationAmountUsd}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
