import { expectedFeeUsd, type StoredFee } from "@/lib/payments/feeCalculation";

/**
 * Reglas de "Marcar pagado y confirmar reserva" (validación manual del fee, DR8 — docs/00 §31, docs/04 §8.10) como funciones PURAS: reciben
 * los hechos ya leídos y la entrada del admin y devuelven el plan a escribir o un error en español. Sin I/O ni `server-only`, para
 * testearlas solas y para que la pantalla muestre la misma diferencia que calcula el servidor (patrón de `evaluateRevocationResolution`).
 * `recordManualFeePayment` hace la lectura y la escritura condicional.
 */

/** Hasta esta diferencia relativa el monto recibido se considera redondeo (supuesto reversible de DR8). */
export const AMOUNT_TOLERANCE_RATIO = 0.01;
/**
 * Piso (supuesto reversible de DR8, Ciclo 71): si lo recibido es menos del 90 % del fee esperado, solo un `superadmin` puede
 * confirmar el pago. Entre el 90 % y el 99 % (fuera de tolerancia) alcanza con el checkbox de diferencia + el motivo.
 */
export const AMOUNT_FLOOR_RATIO = 0.9;
/** Monto mínimo aceptado, DESPUÉS de redondear a centavos (la columna `received_amount` exige > 0). */
export const MIN_RECEIVED_AMOUNT = 0.01;
/** Motivo mínimo siempre obligatorio (docs/07 §17.4). */
export const REASON_MIN = 5;
/** Motivo mínimo con override "sin comprobante" o con diferencia de monto fuera de tolerancia. */
export const REASON_STRICT_MIN = 10;
export const REASON_MAX = 1000;
export const MAX_RECEIVED_AMOUNT = 1_000_000_000;
export const PAYMENT_CURRENCIES = ["ARS", "USD"] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

/** Estados desde los que el admin puede validar (el resto ya no está pendiente). */
export const VALIDATABLE_STATUSES = ["pending_payment_method", "pending_manual_payment"] as const;

export type ManualFeeIntent = "confirm" | "confirm_without_receipt";

export type ManualFeeInput = {
  reason: string;
  /** Monto recibido tal como llegó del formulario (texto o número). */
  receivedAmount: string | number | null;
  paymentCurrency: string;
  /** `confirm_without_receipt` = override explícito (el botón "Confirmar sin comprobante"). */
  intent: string;
  /** Checkbox de la segunda confirmación del override. */
  confirmWithoutReceipt: boolean;
  /** Checkbox "Verifiqué el pago". */
  verified: boolean;
  /** Checkbox "Acepto cobrar este monto aunque difiere del fee esperado" (obligatorio fuera de la tolerancia del 1 %). */
  acceptAmountDifference: boolean;
};

export type ManualFeeFacts = {
  feeStatus: string;
  /** `manual_payment_file_id` no es null. */
  hasReceipt: boolean;
  expiresAt: string | null;
  feeAmountArs: number;
  feeAmountUsd: number | null;
  feeBaseUsd: number;
  feeBaseArs: number;
  /** `reservations.status` de la reserva del fee (`null` si no se encontró). */
  reservationStatus: string | null;
  /** `external_residence_payments.status` del pago a la residencia (`null` si no se encontró). */
  residencePaymentStatus: string | null;
};

function normalizeAmountText(raw: string): string {
  return raw.trim().replace(/\s+/g, "").replace(/^(ARS|USD|\$)/i, "");
}

/** Puntos de miles sin coma decimal ("1.234", "140.500", "1.234.567"): se leen igual como decimal o como miles → ambiguos. */
const DOT_THOUSANDS = /^\d{1,3}(\.\d{3})+$/;

/**
 * Interpreta el monto que escribió el admin. Formatos aceptados (y solo esos):
 *  - enteros: `140500`
 *  - punto decimal canónico (el del input numérico): `140500.5`, `140500.50`
 *  - es-AR: `140500,5`, `140500,50` o con miles `140.500,50` (la coma es SIEMPRE el decimal, con 1 o 2 dígitos)
 * Se rechazan (devuelven `null`) los formatos AMBIGUOS que podrían leerse como 140,5 o como 140500: `140.500`, `1.234`, `1,234`,
 * `1,234.5` (formato en-US) y cualquier otro mix de separadores. Es dinero: ante la duda se pide reescribirlo sin separador de miles.
 */
export function parseReceivedAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = normalizeAmountText(raw);
  if (!text) return null;
  let value: number | null = null;
  if (/^\d+$/.test(text)) value = Number(text);
  else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(text)) value = Number(text.replace(/\./g, "").replace(",", "."));
  else if (/^\d+,\d{1,2}$/.test(text)) value = Number(text.replace(",", "."));
  else if (/^\d+\.\d+$/.test(text) && !DOT_THOUSANDS.test(text)) value = Number(text);
  return value !== null && Number.isFinite(value) ? value : null;
}

/** `true` si el texto tiene dígitos y separadores pero no se puede interpretar sin riesgo (ver `parseReceivedAmount`). */
export function isAmbiguousAmountText(raw: string | number | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const text = normalizeAmountText(raw);
  return /^\d[\d.,]*$/.test(text) && /[.,]/.test(text) && parseReceivedAmount(text) === null;
}

export const AMBIGUOUS_AMOUNT_ERROR =
  "El monto es ambiguo (los puntos o comas pueden leerse como miles o como decimales). Escribilo sin separador de miles: por ejemplo 140500 o 140500,50.";

export type AmountComparison = {
  expected: number;
  received: number;
  /** `received - expected` (en la moneda del pago, redondeado a 2 decimales). */
  difference: number;
  /** Diferencia relativa al esperado (0.012 = 1,2 %), siempre positiva. */
  differenceRatio: number;
  /** `true` si no hay diferencia alguna. */
  exact: boolean;
  /** `true` si la diferencia es de hasta el 1 %. */
  withinTolerance: boolean;
  /** `true` si lo recibido es menos del 90 % del esperado (`AMOUNT_FLOOR_RATIO`): solo un superadmin lo puede confirmar. */
  belowFloor: boolean;
};

/** Compara el monto recibido contra el esperado. `expected` debe ser > 0. */
export function compareReceivedAmount(expected: number, received: number): AmountComparison {
  const difference = Math.round((received - expected) * 100) / 100;
  const differenceRatio = expected > 0 ? Math.abs(difference) / expected : Number.POSITIVE_INFINITY;
  return {
    expected,
    received,
    difference,
    differenceRatio,
    exact: difference === 0,
    withinTolerance: differenceRatio <= AMOUNT_TOLERANCE_RATIO + 1e-9,
    belowFloor: expected > 0 && received < expected * AMOUNT_FLOOR_RATIO - 1e-9,
  };
}

/** Fee esperado en la moneda del pago, a partir de lo guardado (nunca de lo que manda el cliente). `null` si no se puede calcular. */
export function expectedAmountFor(currency: string, facts: Pick<ManualFeeFacts, "feeAmountArs" | "feeAmountUsd" | "feeBaseUsd" | "feeBaseArs">): number | null {
  if (currency === "ARS") return facts.feeAmountArs > 0 ? facts.feeAmountArs : null;
  if (currency === "USD") {
    const stored: StoredFee = {
      feeBaseUsd: facts.feeBaseUsd,
      feeBaseArs: facts.feeBaseArs,
      feeAmountArs: facts.feeAmountArs,
      feeAmountUsd: facts.feeAmountUsd,
    };
    return expectedFeeUsd(stored);
  }
  return null;
}

function formatMoney(currency: string, value: number): string {
  return `${currency} ${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
}

export type ValidatedManualFeeInput = {
  reason: string;
  receivedAmount: number;
  paymentCurrency: PaymentCurrency;
  withoutReceipt: boolean;
};

/**
 * Validaciones que no dependen de la base: motivo, moneda, monto, confirmaciones. Corre ANTES de leer nada (el servidor rechaza sin
 * tocar la DB). Los mensajes son accionables y en español.
 */
export function validateManualFeeInput(input: ManualFeeInput): { ok: true; value: ValidatedManualFeeInput } | { ok: false; error: string } {
  const reason = input.reason.trim();
  const withoutReceipt = input.intent === "confirm_without_receipt";
  if (input.intent !== "confirm" && !withoutReceipt) return { ok: false, error: "Acción inválida. Recargá la pantalla e intentá de nuevo." };

  if (reason.length < REASON_MIN) return { ok: false, error: "Escribí un motivo para que quede registrado." };
  if (reason.length > REASON_MAX) return { ok: false, error: `El motivo es demasiado largo (máximo ${REASON_MAX} caracteres).` };
  if (withoutReceipt) {
    if (reason.length < REASON_STRICT_MIN) {
      return { ok: false, error: `Para confirmar sin comprobante explicá el motivo en al menos ${REASON_STRICT_MIN} caracteres.` };
    }
    if (!input.confirmWithoutReceipt) {
      return { ok: false, error: "Marcá la confirmación de que vas a validar este pago sin comprobante." };
    }
  }

  if (!(PAYMENT_CURRENCIES as readonly string[]).includes(input.paymentCurrency)) return { ok: false, error: "Moneda inválida." };

  if (isAmbiguousAmountText(input.receivedAmount)) return { ok: false, error: AMBIGUOUS_AMOUNT_ERROR };
  const amount = parseReceivedAmount(input.receivedAmount);
  if (amount === null) return { ok: false, error: "Cargá el monto realmente recibido (un número mayor a 0)." };
  if (amount > MAX_RECEIVED_AMOUNT) return { ok: false, error: "El monto recibido es demasiado grande. Revisalo." };
  // El mínimo se chequea DESPUÉS de redondear: 0.001 no puede pasar como "mayor a 0" y terminar guardado como 0.
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < MIN_RECEIVED_AMOUNT) return { ok: false, error: "Cargá el monto realmente recibido (mínimo 0,01)." };

  if (!input.verified) return { ok: false, error: "Confirmá que verificaste el pago antes de continuar." };

  return {
    ok: true,
    value: {
      reason,
      receivedAmount: rounded,
      paymentCurrency: input.paymentCurrency as PaymentCurrency,
      withoutReceipt,
    },
  };
}

export type ManualFeePlan = {
  reason: string;
  paymentCurrency: PaymentCurrency;
  receivedAmount: number;
  expectedAmount: number;
  difference: number;
  differenceRatio: number;
  exact: boolean;
  withinTolerance: boolean;
  confirmedWithoutReceipt: boolean;
  hadReceipt: boolean;
  /** Lo recibido es menos del 90 % del esperado (solo lo confirmó un superadmin). */
  belowFloor: boolean;
  /** El admin tildó "Acepto la diferencia" (siempre `true` si el monto está fuera de tolerancia). */
  amountDifferenceAccepted: boolean;
};

export type EvaluateManualFeeResult = { ok: true; plan: ManualFeePlan } | { ok: false; error: string };

export const EXPIRED_ERROR =
  "El plazo para pagar este fee ya venció. Reabrilo desde Actividad → Reservas antes de marcarlo como pagado.";

export const PENDING_REVIEW_ERROR =
  "El pago todavía no pasó a revisión manual: hay un comprobante cargado pero el pagador no terminó de informar el pago. Recargá la pantalla o esperá a que lo termine.";

/** Hechos de la base + entrada del admin → plan a escribir, o el primer error que corresponda. */
export function evaluateManualFeePayment(params: {
  facts: ManualFeeFacts;
  input: ManualFeeInput;
  /** Rol de quien confirma, de la sesión (nunca del cliente): el piso del 90 % exige `superadmin`. */
  actorRole: "admin" | "superadmin";
  now?: Date;
}): EvaluateManualFeeResult {
  const { facts } = params;
  const now = params.now ?? new Date();

  const validated = validateManualFeeInput(params.input);
  if (!validated.ok) return validated;
  const { reason, receivedAmount, paymentCurrency, withoutReceipt } = validated.value;

  if (facts.feeStatus === "expired") return { ok: false, error: EXPIRED_ERROR };
  if (!(VALIDATABLE_STATUSES as readonly string[]).includes(facts.feeStatus)) {
    return { ok: false, error: "Ese pago ya no está pendiente de validación." };
  }
  if (facts.reservationStatus !== "pending_estured_fee") {
    return { ok: false, error: "La reserva ya no está esperando el pago del fee. Recargá la pantalla." };
  }
  if (facts.residencePaymentStatus !== "reported_received_by_residence") {
    return { ok: false, error: "El pago a la residencia todavía no fue confirmado." };
  }
  // DR64 (d): un fee en `pending_manual_payment` ya fue informado a tiempo y no vence; el plazo solo se exige en `pending_payment_method`.
  if (facts.feeStatus === "pending_payment_method" && facts.expiresAt) {
    const deadline = new Date(facts.expiresAt);
    if (!Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime()) return { ok: false, error: EXPIRED_ERROR };
  }

  if (withoutReceipt && facts.hasReceipt) {
    return { ok: false, error: "Ese pago tiene un comprobante cargado: revisalo y confirmá con él en lugar de validar sin comprobante." };
  }
  if (!withoutReceipt && !facts.hasReceipt) {
    return {
      ok: false,
      error: "Todavía no hay comprobante cargado. Esperá a que lo suban o, si corresponde, usá «Confirmar sin comprobante» con un motivo.",
    };
  }
  if (!withoutReceipt && facts.feeStatus !== "pending_manual_payment") {
    return { ok: false, error: PENDING_REVIEW_ERROR };
  }

  const expected = expectedAmountFor(paymentCurrency, facts);
  if (expected === null) {
    return { ok: false, error: `No pudimos calcular el fee esperado en ${paymentCurrency}. Elegí ARS o revisá el pago.` };
  }
  const comparison = compareReceivedAmount(expected, receivedAmount);
  if (comparison.belowFloor && params.actorRole !== "superadmin") {
    return {
      ok: false,
      error: `El monto recibido (${formatMoney(paymentCurrency, receivedAmount)}) es menos del ${Math.round(AMOUNT_FLOOR_RATIO * 100)} % del fee esperado (${formatMoney(paymentCurrency, expected)}). Solo un superadmin puede confirmar una diferencia así: derivalo.`,
    };
  }
  if (!comparison.withinTolerance && !params.input.acceptAmountDifference) {
    return {
      ok: false,
      error: `El monto recibido (${formatMoney(paymentCurrency, receivedAmount)}) difiere ${formatPercent(comparison.differenceRatio)} del fee esperado (${formatMoney(paymentCurrency, expected)}). Marcá que aceptás la diferencia o corregí el monto.`,
    };
  }
  if (!comparison.withinTolerance && reason.length < REASON_STRICT_MIN) {
    return {
      ok: false,
      error: `El monto recibido (${formatMoney(paymentCurrency, receivedAmount)}) difiere ${formatPercent(comparison.differenceRatio)} del fee esperado (${formatMoney(paymentCurrency, expected)}). Explicá la diferencia en el motivo (al menos ${REASON_STRICT_MIN} caracteres) o corregí el monto.`,
    };
  }

  return {
    ok: true,
    plan: {
      reason,
      paymentCurrency,
      receivedAmount,
      expectedAmount: expected,
      difference: comparison.difference,
      differenceRatio: comparison.differenceRatio,
      exact: comparison.exact,
      withinTolerance: comparison.withinTolerance,
      confirmedWithoutReceipt: withoutReceipt,
      hadReceipt: facts.hasReceipt,
      belowFloor: comparison.belowFloor,
      amountDifferenceAccepted: !comparison.withinTolerance && params.input.acceptAmountDifference,
    },
  };
}
