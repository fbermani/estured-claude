export type RenewalOfferStatusTone = "amber" | "sage" | "neutral" | "danger";

/**
 * Copy de `renewal_offers.status` para el lado residencia — compartido
 * entre `/residence/[residence_id]/renewals` (lista) y su detalle
 * `[id]` (antes duplicado byte a byte en ambos archivos).
 */
export const RESIDENCE_OFFER_STATUS_COPY: Record<string, { label: string; tone: RenewalOfferStatusTone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  sent: { label: "Oferta enviada", tone: "amber" },
  viewed: { label: "Vista por el estudiante", tone: "amber" },
  accepted_by_student: { label: "Aceptada", tone: "sage" },
  rejected_by_student: { label: "Rechazada", tone: "danger" },
  expired: { label: "Vencida", tone: "neutral" },
  // Fase 2 (pago a residencia → fee EstuRed → comprobante).
  residence_payment_pending: { label: "Esperando pago del estudiante", tone: "amber" },
  estured_fee_pending: { label: "Esperando fee EstuRed", tone: "amber" },
  confirmed: { label: "Confirmada", tone: "sage" },
  receipt_issued: { label: "Confirmada — comprobante emitido", tone: "sage" },
};
