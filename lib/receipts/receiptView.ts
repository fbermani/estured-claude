import { formatDate } from "@/lib/dates/format";
import { ADJUSTMENT_POLICY_LABEL } from "@/lib/applications/agreedConditions";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";

/**
 * Contenido del Comprobante de Reserva Confirmada (docs/01 §14, docs/08
 * §6.9), compartido por la pantalla `/students/receipts/[id]` y el PDF para
 * que no diverjan (H07). Presentación pura: arma las filas a mostrar desde
 * el `receipt_payload` (congelado al emitir) y, para comprobantes viejos que
 * no guardaron algún dato, desde un suplemento leído de las tablas reales.
 *
 * NO inventa campos: lo que no existe en el payload ni en el suplemento no
 * se muestra (una fila vacía confunde más que su ausencia). El comprobante
 * NO es una factura fiscal (docs/00; entidades separadas).
 */

export type ReceiptPayload = {
  student?: { first_name?: string; last_initial?: string };
  residence?: { name?: string; public_area?: string };
  room_type?: string;
  desired_start_date?: string;
  initial_duration_months?: number;
  academic_objective?: string;
  final_conditions?: {
    monthly_price_usd?: number | string;
    monthly_price_ars?: number | string;
    enrollment_fee_usd?: number | string | null;
    enrollment_fee_ars?: number | string | null;
    deposit_usd?: number | string | null;
    deposit_ars?: number | string | null;
    exchange_rate_ars_per_usd?: number | string;
    exchange_rate_date?: string;
    adjustment_policy?: string;
  };
  /** Monto que la residencia informó como recibido (se guarda al emitir, comprobantes nuevos). */
  residence_payment?: { amount_usd?: number | null; amount_ars?: number | null; reported_at?: string | null };
  estured_fee?: {
    amount_ars?: number | string;
    amount_usd?: number | string | null;
    currency?: string;
    paid_at?: string;
    payer_billing_name?: string;
  };
  adjustment_policy?: string;
  disclaimer?: string;
};

/** Datos leídos de las tablas reales para comprobantes emitidos antes de que el payload los guardara. */
export type ReceiptSupplement = {
  /** Condiciones del snapshot de la reserva, para comprobantes viejos cuyo payload no las guardó completas. */
  snapshot?: ReceiptPayload["final_conditions"];
  residencePayment?: { usd: number | null; ars: number | null } | null;
  /** Quien pagó el fee, solo si NO es el estudiante (familiar pagador, docs/01 §14). */
  familyPayerName?: string | null;
};

export type ReceiptRow = { label: string; value: string };

export const FUTURE_PAYMENTS_NOTICE =
  "Los pagos mensuales posteriores y los ajustes de tarifa se acuerdan y se pagan directamente con la residencia, según la política de ajustes indicada. EstuRed no garantiza pagos futuros ni la conducta de las partes.";

export const INVOICE_NOTICE =
  "Este comprobante no es una factura fiscal. La factura del fee EstuRed es un documento aparte, independiente de este comprobante.";

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const usd = (n: number) => `USD ${n.toLocaleString("es-AR")}`;
const ars = (n: number) => `ARS ${n.toLocaleString("es-AR")}`;

function usdAndArs(usdValue: number | null, arsValue: number | null): string | null {
  if (usdValue === null && arsValue === null) return null;
  if (usdValue === null) return ars(arsValue!);
  return arsValue === null ? usd(usdValue) : `${usd(usdValue)} · ${ars(arsValue)}`;
}

function dateOnly(value: string | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateOnly(value) : value;
}

export function buildReceiptRows(
  payload: ReceiptPayload,
  supplement: ReceiptSupplement = {},
  issuedAt?: string | null,
): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) rows.push({ label, value });
  };
  // El payload (congelado al emitir) manda; el snapshot solo completa lo que el comprobante viejo no guardó.
  const fc: NonNullable<ReceiptPayload["final_conditions"]> = { ...(supplement.snapshot ?? {}) };
  for (const [key, value] of Object.entries(payload.final_conditions ?? {})) {
    if (value !== null && value !== undefined) (fc as Record<string, unknown>)[key] = value;
  }

  add("Estudiante", [payload.student?.first_name, payload.student?.last_initial].filter(Boolean).join(" "));
  if (supplement.familyPayerName) add("Fee pagado por (familiar)", supplement.familyPayerName);
  add(
    "Residencia",
    [payload.residence?.name, payload.residence?.public_area].filter(Boolean).join(" · "),
  );
  add("Tipo de habitación", payload.room_type);
  add("Fecha de ingreso", dateOnly(payload.desired_start_date));
  add(
    "Duración inicial",
    payload.initial_duration_months ? `${payload.initial_duration_months} meses` : null,
  );
  add("Tarifa mensual acordada", usdAndArs(num(fc.monthly_price_usd), num(fc.monthly_price_ars)));
  const enrollment = num(fc.enrollment_fee_usd);
  if (enrollment) add("Matrícula (no reembolsable)", usdAndArs(enrollment, num(fc.enrollment_fee_ars)));
  const deposit = num(fc.deposit_usd);
  if (deposit) add("Depósito (reembolsable)", usdAndArs(deposit, num(fc.deposit_ars)));
  const policy = payload.adjustment_policy ?? fc.adjustment_policy;
  add("Política de ajustes", policy ? ADJUSTMENT_POLICY_LABEL[policy] : null);

  const informedUsd = num(payload.residence_payment?.amount_usd) ?? supplement.residencePayment?.usd ?? null;
  const informedArs = num(payload.residence_payment?.amount_ars) ?? supplement.residencePayment?.ars ?? null;
  add("Pago a la residencia (informado por la residencia)", usdAndArs(informedUsd, informedArs));

  const rate = num(fc.exchange_rate_ars_per_usd);
  if (rate) {
    const rateDate = dateOnly(fc.exchange_rate_date);
    add("Tipo de cambio de referencia", `${ars(rate)} por USD${rateDate ? ` (al ${rateDate})` : ""}`);
  }

  const feeArs = num(payload.estured_fee?.amount_ars);
  const feeUsd = num(payload.estured_fee?.amount_usd);
  if (feeArs !== null || feeUsd !== null) {
    const paidInUsd = payload.estured_fee?.currency === "USD" && feeUsd !== null;
    add("Fee EstuRed pagado", paidInUsd ? usd(feeUsd!) : feeArs !== null ? ars(feeArs) : usd(feeUsd!));
  }
  if (payload.estured_fee?.paid_at)
    add("Fee pagado el", formatDate(payload.estured_fee.paid_at));
  if (issuedAt) add("Emitido", formatDate(issuedAt));
  return rows;
}
