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
};
