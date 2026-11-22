import { expectedFeeUsd } from "@/lib/payments/feeCalculation";
import { buildInstructionsSnapshot } from "@/lib/applications/reservationCollectionChoice";
import { PAYMENT_METHOD_KEYS, maskPaymentDetails, paymentMethodLabel, type Checked } from "@/lib/payments/paymentMethods";

/**
 * Cobro del fee de EstuRed con medios del catálogo (DR64, `docs/00`; `docs/07` §17.6 a §17.8). Lógica PURA, sin `server-only` y sin datos
 * reales: la usan el servidor (elección y congelado), la pantalla del pagador, la del admin y los tests.
 */

export type FeeCurrency = "ARS" | "USD";
export const FEE_CURRENCIES: readonly FeeCurrency[] = ["ARS", "USD"];

export function isFeeCurrency(value: unknown): value is FeeCurrency {
  return value === "ARS" || value === "USD";
}

/** Medio con el que se cobra hoy el fee si el admin todavía no habilitó ninguno: la cuenta de `payment_settings` (DR64 (a), respaldo). */
export const FEE_FALLBACK_METHOD_KEY = "transfer_ars" as const;

/** Orden estable de los medios: el del catálogo. Una clave desconocida va al final. */
export function compareByCatalog(a: string, b: string): number {
  const ia = (PAYMENT_METHOD_KEYS as readonly string[]).indexOf(a);
  const ib = (PAYMENT_METHOD_KEYS as readonly string[]).indexOf(b);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
}

/** Lo único del medio que viaja al cliente para elegir: nada de datos de cobro. */
export type FeeMethodChoice = { key: string; label: string; currency: FeeCurrency };

/** `payment_settings` (una cuenta) como texto de cobro de un medio. Mismo orden que el formulario del admin. */
export function composeSettingsDetails(settings: {
  account_holder: string;
  bank_name: string;
  alias: string;
  cbu: string;
  holder_cuit: string | null;
  instructions: string | null;
}): string {
  const lines = [
    `Titular: ${settings.account_holder}`,
    `Banco: ${settings.bank_name}`,
    `Alias: ${settings.alias}`,
    `CBU: ${settings.cbu}`,
  ];
  if (settings.holder_cuit) lines.push(`CUIT/CUIL del titular: ${settings.holder_cuit}`);
  const extra = (settings.instructions ?? "").trim();
  if (extra) lines.push(`Indicaciones: ${extra}`);
  return lines.join("\n");
}

/** Fee guardado, tal como se lee de `estured_fee_payments`. */
export type StoredFeeAmounts = {
  fee_amount_ars: number | string | null;
  fee_amount_usd?: number | string | null;
  fee_base_usd: number | string | null;
  fee_base_ars: number | string | null;
};

const toNum = (v: number | string | null | undefined): number => (v === null || v === undefined ? NaN : Number(v));

/**
 * Monto del fee en la moneda del medio. ARS: el guardado. USD: el guardado o, si falta, `fee_amount_ars` ÷ cotización del snapshot
 * (`docs/04` §8.4): la MISMA función que usa la validación del admin (DR8 (2)), para que lo que se muestra sea lo que se compara.
 * `null` si no hay forma de calcularlo.
 */
export function feeAmountInCurrency(fee: StoredFeeAmounts, currency: FeeCurrency): number | null {
  const ars = toNum(fee.fee_amount_ars);
  if (currency === "ARS") return Number.isFinite(ars) && ars > 0 ? ars : null;
  const usdStored = toNum(fee.fee_amount_usd);
  return expectedFeeUsd({
    feeBaseUsd: toNum(fee.fee_base_usd),
    feeBaseArs: toNum(fee.fee_base_ars),
    feeAmountArs: ars,
    feeAmountUsd: Number.isFinite(usdStored) ? usdStored : null,
  });
}

/** Texto que se congela al elegir el medio: «Nombre del medio\ndatos». Mismo formato que el cobro de la reserva (DR63). */
export function buildFeeInstructionsSnapshot(methodKey: string, approved: { methodLabel: string | null; details: string | null }): Checked<string> {
  return buildInstructionsSnapshot(methodKey, approved);
}

/** Separa «Nombre del medio\ndatos» (formato de `buildFeeInstructionsSnapshot`). */
export function splitFeeSnapshot(snapshot: string | null | undefined): { label: string | null; details: string | null } {
  if (!snapshot) return { label: null, details: null };
  const at = snapshot.indexOf("\n");
  if (at === -1) return { label: null, details: snapshot.trim() || null };
  return { label: snapshot.slice(0, at).trim() || null, details: snapshot.slice(at + 1).trim() || null };
}

/** «No pude realizar el pago» abierto: hay aviso y el admin todavía no respondió (DR64 (e)). */
export function isFeeIssueOpen(fee: { student_payment_issue_at?: string | null; student_payment_issue_resolved_at?: string | null }): boolean {
  return Boolean(fee.student_payment_issue_at) && !fee.student_payment_issue_resolved_at;
}

/** Vista auditable de un medio del fee: el dato de cobro va enmascarado (solo los últimos 4 caracteres). */
export function feeMethodAuditView(row: { method_key: string; method_label: string | null; currency: string; is_enabled: boolean; details: string | null }) {
  return {
    method_key: row.method_key,
    method_label: row.method_label,
    currency: row.currency,
    is_enabled: row.is_enabled,
    details: row.details ? maskPaymentDetails(row.details) : null,
  };
}

export type FeeMethodState = { method_key: string; method_label: string | null; currency: string; is_enabled: boolean; details: string | null };

/** Qué cambió entre dos versiones de un medio, SIN los valores (para avisar a los superadmin sin datos de cobro). */
export function describeFeeMethodChange(before: FeeMethodState | null, after: FeeMethodState): string[] {
  const name = paymentMethodLabel(after.method_key, after.method_label);
  if (!before) return [after.is_enabled ? `Se cargó y habilitó «${name}».` : `Se cargó «${name}» (sin habilitar).`];
  const out: string[] = [];
  if (before.is_enabled !== after.is_enabled) out.push(after.is_enabled ? `Se habilitó «${name}».` : `Se deshabilitó «${name}».`);
  if ((before.details ?? "").trim() !== (after.details ?? "").trim()) out.push(`Cambiaron los datos de cobro de «${name}».`);
  if (before.currency !== after.currency) out.push(`Cambió la moneda de «${name}».`);
  if ((before.method_label ?? "") !== (after.method_label ?? "")) out.push(`Cambió el nombre de «${name}».`);
  return out;
}
