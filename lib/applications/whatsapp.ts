import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatDate } from "@/lib/dates/format";
import { formatUsd } from "@/lib/mock/exchange";
import { formatInitialPaymentLine } from "@/lib/reservations/initialPayment";

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
  /** Pago inicial para reservar a la residencia (snapshot, D7/H08). */
  reservationAmountUsd: number;
  /** Fee EstuRed estimado en USD (opcional): se muestra aparte del pago a la residencia. */
  feeUsd?: number | null;
  /** Fecha límite del pago a la residencia (ISO), solo si ya fue habilitado. */
  paymentDeadlineAt?: string | null;
}): string {
  const digits = params.phone.replace(/[^0-9]/g, "");
  const message =
    `Hola, te escribimos de ${params.residenceName} por tu solicitud de reserva en EstuRed.\n` +
    `Estudiante: ${params.studentName}\n` +
    `Residencia: ${params.residenceName}\n` +
    `Tipo de habitación: ${params.roomTypeName}\n` +
    `Fecha de ingreso deseada: ${formatDateOnly(params.desiredStartDate)}\n` +
    `Duración: ${params.durationMonths} meses\n` +
    `Pago inicial para reservar: ${formatInitialPaymentLine({
      residenceUsd: params.reservationAmountUsd,
      deadlineLabel: params.paymentDeadlineAt ? formatDate(params.paymentDeadlineAt) : null,
      feeUsd: params.feeUsd ?? null,
      formatUsd,
    })}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
