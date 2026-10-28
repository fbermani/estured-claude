import { usdToArs, usdToArsRounded } from "@/lib/mock/exchange";
import { FEE_PERCENT } from "@/lib/applications/fee";

/**
 * Pago inicial para reservar (decisión D7 / hallazgo H08 de la auditoría
 * 2026-10-20; `docs/06` §8.1, supuesto reversible `docs/13` §4).
 *
 * Es lo que el estudiante le paga A LA RESIDENCIA para reservar. Por defecto
 * es el primer mes de la tarifa del tipo elegido; la residencia puede fijar
 * un monto fijo en USD. NO es el fee de EstuRed, ni la matrícula, ni el
 * depósito (entidades separadas: `docs/00`, regla 3 de `CLAUDE.md`).
 *
 * Módulo puro (sin `server-only`): lo usan el server al armar el snapshot y
 * el cliente (`ApplyForm`) en la previa. El valor que ve el estudiante tras
 * enviar la solicitud sale SIEMPRE del snapshot
 * (`application_snapshots.reservation_payment_amount_usd/ars`), así que
 * cambiar el campo después no altera solicitudes ya creadas.
 */

/**
 * `enrollment_only` (DR18 t3, migración 0060): el pago inicial es solo la matrícula vigente (ya con descuento). Sin matrícula
 * (o bonificada al 100 %) cae al primer mes, igual que un monto fijo inválido.
 */
export type InitialPaymentMode = "one_month" | "custom_usd" | "enrollment_only";

export const INITIAL_PAYMENT_MAX_USD = 100_000;

export type InitialPaymentConfig = {
  mode: InitialPaymentMode;
  /** Monto fijo en USD; solo cuenta si `mode === "custom_usd"`. */
  customUsd: number | null;
};

/** Residencias sin el campo (o con un valor desconocido) se comportan como "primer mes". */
export function normalizeInitialPaymentMode(value: unknown): InitialPaymentMode {
  if (value === "custom_usd") return "custom_usd";
  if (value === "enrollment_only") return "enrollment_only";
  return "one_month";
}

/** Lee la configuración desde una fila de `residences` (columnas pueden faltar en filas viejas). */
export function initialPaymentConfigFromRow(row: {
  reservation_initial_payment_mode?: unknown;
  reservation_initial_payment_usd?: unknown;
}): InitialPaymentConfig {
  const mode = normalizeInitialPaymentMode(row.reservation_initial_payment_mode);
  const raw = row.reservation_initial_payment_usd;
  const usd = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  return { mode, customUsd: usd !== null && Number.isFinite(usd) && usd > 0 ? usd : null };
}

/**
 * Monto en USD del pago inicial para una tarifa mensual dada. Si el modo es
 * `custom_usd` pero no hay un monto válido (dato inconsistente), cae al primer
 * mes: nunca devuelve 0 ni un monto inventado.
 */
export function resolveInitialPaymentUsd(
  config: InitialPaymentConfig,
  monthlyPriceUsd: number,
  /** Matrícula vigente NETA (con descuento) en USD; solo cuenta en el modo `enrollment_only`. */
  enrollmentNetUsd?: number | null,
): number {
  if (config.mode === "custom_usd" && config.customUsd !== null && config.customUsd > 0) {
    return config.customUsd;
  }
  if (config.mode === "enrollment_only" && enrollmentNetUsd != null && enrollmentNetUsd > 0) {
    return enrollmentNetUsd;
  }
  return monthlyPriceUsd;
}

export type InitialPayment = {
  /** Modo EFECTIVO: `enrollment_only` sin matrícula cobrable queda como `one_month`. */
  mode: InitialPaymentMode;
  /** Lo que se paga a la residencia (USD). */
  usd: number;
  /** ARS exactos para guardar en el snapshot (mismo criterio que matrícula/fee). */
  arsSnapshot: number;
  /** ARS redondeados a 500/000, solo para mostrar (referencial, con `ExchangeRateNote`). */
  arsDisplay: number;
};

export function buildInitialPayment(
  config: InitialPaymentConfig,
  monthlyPriceUsd: number,
  arsPerUsd: number,
  enrollmentNetUsd?: number | null,
): InitialPayment {
  const usd = resolveInitialPaymentUsd(config, monthlyPriceUsd, enrollmentNetUsd);
  const mode: InitialPaymentMode =
    config.mode === "custom_usd" && config.customUsd !== null && config.customUsd > 0
      ? "custom_usd"
      : config.mode === "enrollment_only" && enrollmentNetUsd != null && enrollmentNetUsd > 0
        ? "enrollment_only"
        : "one_month";
  return { mode, usd, arsSnapshot: usdToArs(usd, arsPerUsd), arsDisplay: usdToArsRounded(usd, arsPerUsd) };
}

/** Fee EstuRed estimado en USD (5% de la base), solo para el desglose "A la residencia / A EstuRed". */
export function estimatedFeeUsd(feeBaseUsd: number): number {
  return Math.round(feeBaseUsd * FEE_PERCENT * 100) / 100;
}

/** Texto legible para el log de auditoría de tarifas (`tariff_change_logs`): deja claro el cambio de modo. */
export function describeInitialPaymentForLog(config: InitialPaymentConfig): string {
  if (config.mode === "enrollment_only") return "Solo la matrícula";
  return config.mode === "custom_usd" && config.customUsd !== null
    ? `Monto fijo USD ${config.customUsd.toLocaleString("es-AR")}`
    : "Primer mes";
}

export type InitialPaymentInputResult =
  | { ok: true; value: InitialPaymentConfig }
  | { ok: false; error: string };

/**
 * Validación server-side del campo del formulario de condiciones. `mode`
 * desconocido o ausente = primer mes (por defecto); `custom_usd` exige un
 * monto mayor a 0 y hasta `INITIAL_PAYMENT_MAX_USD`. En modo primer mes el
 * monto se descarta (la DB lo exige en null).
 */
export function parseInitialPaymentInput(raw: { mode?: unknown; usd?: unknown }): InitialPaymentInputResult {
  if (raw.mode !== undefined && raw.mode !== null && raw.mode !== "one_month" && raw.mode !== "custom_usd" && raw.mode !== "enrollment_only") {
    return { ok: false, error: "El pago inicial para reservar no es válido." };
  }
  const mode = normalizeInitialPaymentMode(raw.mode);
  if (mode === "one_month" || mode === "enrollment_only") return { ok: true, value: { mode, customUsd: null } };

  const text = typeof raw.usd === "string" ? raw.usd.trim() : raw.usd;
  const parsed = text === null || text === undefined || text === "" ? NaN : Number(text);
  // Se valida el valor YA redondeado a centavos: 0,004 se guardaría como 0 y violaría el CHECK (> 0) de la DB.
  const usd = Math.round(parsed * 100) / 100;
  if (!Number.isFinite(usd) || usd < 0.01) {
    return {
      ok: false,
      error: "Indicá el monto del pago inicial en USD (mayor a 0) o elegí \"primer mes\".",
    };
  }
  if (usd > INITIAL_PAYMENT_MAX_USD) {
    return { ok: false, error: "El pago inicial no puede superar USD 100.000." };
  }
  return { ok: true, value: { mode, customUsd: usd } };
}

/**
 * Pago inicial del snapshot FINAL al aceptar una propuesta de ajuste (D7/H08).
 * Reglas, en orden:
 *  1. Si la propuesta fija explícitamente un pago inicial, se usa ese.
 *  2. Si no, y la residencia está en modo `one_month` (y el original era
 *     efectivamente el primer mes), el pago inicial sigue la tarifa mensual
 *     NEGOCIADA: si baja la renta, baja el pago inicial.
 *  3. Si no (modo `custom_usd`, o un original que no era el primer mes), queda
 *     el monto del snapshot original.
 * El ARS se recalcula siempre con la cotización del snapshot original
 * (`usdToArs(usd, original.exchange_rate_ars_per_usd)`): la negociación nunca
 * actualiza la cotización (docs/06 §11.2).
 */
export function resolveNegotiatedInitialPaymentUsd(params: {
  proposedUsd: number | null;
  originalInitialUsd: number;
  originalMonthlyUsd: number;
  finalMonthlyUsd: number;
  mode: InitialPaymentMode;
  /** Matrícula del snapshot original y la acordada (USD, neta); solo para el modo `enrollment_only`. */
  originalEnrollmentUsd?: number | null;
  finalEnrollmentUsd?: number | null;
}): number {
  if (params.proposedUsd !== null && params.proposedUsd > 0) return params.proposedUsd;
  if (params.mode === "enrollment_only") {
    const original = params.originalEnrollmentUsd ?? 0;
    const final = params.finalEnrollmentUsd ?? 0;
    // Era la matrícula: acompaña la matrícula negociada; si se negoció a 0, cae al primer mes (nunca un pago inicial de 0).
    if (original > 0 && params.originalInitialUsd === original) return final > 0 ? final : params.finalMonthlyUsd;
    return params.originalInitialUsd;
  }
  const originalWasFirstMonth = params.originalInitialUsd === params.originalMonthlyUsd;
  if (params.mode === "one_month" && originalWasFirstMonth) return params.finalMonthlyUsd;
  return params.originalInitialUsd;
}

/**
 * Texto del desglose "A la residencia: USD X antes del dd/mm/aaaa · A EstuRed:
 * fee USD Y" para el mensaje de WhatsApp y resúmenes de texto. La fecha límite
 * se omite si todavía no existe (`payment_deadline_at` recién se fija al
 * habilitar el pago a la residencia). `formatUsd`/`formatDate` se inyectan
 * para mantener el módulo sin dependencias de formato.
 */
export function formatInitialPaymentLine(params: {
  residenceUsd: number;
  deadlineLabel?: string | null;
  feeUsd?: number | null;
  formatUsd: (usd: number) => string;
}): string {
  const { residenceUsd, deadlineLabel, feeUsd, formatUsd } = params;
  const residencePart = `A la residencia: ${formatUsd(residenceUsd)}${deadlineLabel ? ` antes del ${deadlineLabel}` : ""}`;
  return feeUsd != null && feeUsd > 0 ? `${residencePart} · A EstuRed: fee ${formatUsd(feeUsd)}` : residencePart;
}
