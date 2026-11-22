import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";

/**
 * Avisos in-app al PAGADOR del fee (DR64 (d), (e) y (f)). Texto genérico: nunca llevan datos de cobro, montos ni el motivo que escribió
 * el admin, y no prometen disponibilidad ni garantías. Nunca lanza (`createNotification` ya traga sus errores).
 */

export type FeePayerNoticeKind = "disputed" | "issue_contact" | "issue_reopen" | "reopened_after_dispute" | "reminder_12h" | "method_unavailable";

const COPY: Record<FeePayerNoticeKind, { title: string; body: string }> = {
  disputed: {
    title: "Todavía no encontramos tu pago",
    body: "Revisamos el pago del fee EstuRed y no lo pudimos confirmar. Soporte de EstuRed revisa el caso: tené a mano tu comprobante. La reserva sigue sujeta a confirmación.",
  },
  issue_contact: {
    title: "Recibimos tu aviso sobre el pago",
    body: "Soporte de EstuRed revisa tu caso y te responde por acá. Tenés 48 horas más para pagar el fee. La reserva sigue sujeta a confirmación.",
  },
  issue_reopen: {
    title: "Podés intentar pagar de nuevo",
    body: "EstuRed reabrió el pago del fee: elegí el medio que te sirva y pagá. Tenés 48 horas más. La reserva sigue sujeta a confirmación.",
  },
  reopened_after_dispute: {
    title: "Reabrimos el pago del fee",
    body: "Para confirmar tu pago necesitamos que elijas el medio y subas el comprobante de nuevo. Tenés 48 horas. La reserva sigue sujeta a confirmación.",
  },
  method_unavailable: {
    title: "Elegí de nuevo el medio de pago del fee",
    body: "El medio que habías elegido para pagar el fee EstuRed ya no está disponible. Entrá a tu solicitud y elegí otro medio. Tu plazo no cambia. La reserva sigue sujeta a confirmación.",
  },
  reminder_12h: {
    title: "Tu plazo para pagar el fee vence pronto",
    body: "Te quedan menos de 12 horas para pagar el fee EstuRed. Entrá a tu solicitud para pagar o avisar si no pudiste. El pago se confirma cuando EstuRed lo valida.",
  },
};

export function feePayerNoticeCopy(kind: FeePayerNoticeKind): { title: string; body: string } {
  return COPY[kind];
}

/** Aviso al pagador. `related` es la reserva (o la oferta de renovación) del fee, para el enlace de la campana. */
export async function notifyFeePayer(
  admin: SupabaseClient,
  params: { payerUserId: string; kind: FeePayerNoticeKind; related: { type: "reservations" | "renewal_offers"; id: string } },
): Promise<void> {
  await createNotification(admin, {
    userId: params.payerUserId,
    ...COPY[params.kind],
    relatedEntityType: params.related.type,
    relatedEntityId: params.related.id,
    category: "payments_fee",
  });
}
