import { resolveExpectedAmounts } from "@/lib/applications/reservationCollectionChoice";

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export type ReservationPaymentCurrency = "ARS" | "USD";
export type AgreedReservationAmount = { usd: number; ars: number };

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Monto acordado de la reserva de una solicitud (DR70 (a), DR72 (f)). Lógica PURA: la usan el servidor de «Pago recibido», el formulario
 * de la residencia y la tarjeta del estudiante, para que los tres muestren y guarden lo mismo.
 *
 * Primero los montos congelados en `external_residence_payments` (cobro con medios: es lo que vio el estudiante). Si no están (contacto
 * directo o solicitud anterior a DR63), los del snapshot final de la solicitud, con la cotización congelada (`resolveExpectedAmounts`).
 */
export function resolveAgreedReservationAmount(input: {
  expectedUsd: unknown;
  expectedArs: unknown;
  snapshot: Record<string, unknown> | null;
}): Checked<AgreedReservationAmount> {
  const usd = toNumber(input.expectedUsd);
  const ars = toNumber(input.expectedArs);
  if (usd !== null && ars !== null) return { ok: true, value: { usd, ars } };
  if (!input.snapshot) return { ok: false, error: "No pudimos determinar el monto de la reserva de esta solicitud. Escribile a Soporte." };
  return resolveExpectedAmounts(input.snapshot);
}

/** Moneda en que la residencia dice que le pagaron. Solo `ARS` o `USD`; cualquier otra cosa es un error. */
export function parseReservationPaymentCurrency(raw: unknown): Checked<ReservationPaymentCurrency> {
  if (raw === "ARS" || raw === "USD") return { ok: true, value: raw };
  return { ok: false, error: "Elegí en qué moneda te pagaron." };
}

/** Columnas de `external_residence_payments` a guardar: el monto acordado, solo en la moneda elegida. La otra queda en `null`. */
export function reportedAmountColumns(
  currency: ReservationPaymentCurrency,
  amount: AgreedReservationAmount,
): { amount_reported_ars: number | null; amount_reported_usd: number | null } {
  return currency === "ARS"
    ? { amount_reported_ars: amount.ars, amount_reported_usd: null }
    : { amount_reported_ars: null, amount_reported_usd: amount.usd };
}
