import { describeEnrollmentFee } from "@/lib/residences/enrollmentFee";
import { MAX_EMPTY_MONTHS } from "@/lib/applications/emptyMonths";
import { formatUsd } from "@/lib/mock/exchange";
import { resolveInitialPaymentUsd, type InitialPaymentConfig } from "@/lib/reservations/initialPayment";
import { depositModeLabel, isWithinWindow, todayIso, type DepositMode } from "@/lib/applications/reservationMoney";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";

/**
 * Condiciones que la ficha pública muestra a TODOS (Ciclo 57, H10): solo lectura y presentación.
 * No calcula el fee ni el pago inicial (eso vive en `fee.ts` / `initialPayment.ts`); acá se decide qué
 * filas existen y con qué texto. Si un dato no está cargado, la fila no se muestra (nunca se inventa).
 */

export type AdjustmentPolicyCopy = { label: string; help: string };

const ADJUSTMENT_COPY: Record<string, AdjustmentPolicyCopy> = {
  monthly: { label: "Mensual", help: "La residencia puede actualizar la tarifa todos los meses." },
  quarterly: { label: "Trimestral", help: "La residencia puede actualizar la tarifa cada 3 meses." },
  semiannual: { label: "Semestral", help: "La residencia puede actualizar la tarifa cada 6 meses." },
  annual: { label: "Anual", help: "La residencia puede actualizar la tarifa una vez por año." },
  none: { label: "Sin ajuste", help: "La tarifa no se ajusta durante la estadía inicial." },
};

/** `null` si la política es desconocida o no está cargada (la fila se oculta). */
export function adjustmentPolicyCopy(policy: string | null | undefined): AdjustmentPolicyCopy | null {
  if (!policy) return null;
  return ADJUSTMENT_COPY[policy] ?? null;
}

export type FichaConditionsInput = {
  minimumStayMonths: number | null;
  adjustmentPolicy: string | null;
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  enrollmentFeeFrequency: "once" | "annual";
  depositUsd: number | null;
  emptyMonthChargePercent: number | null;
  initialPayment: InitialPaymentConfig;
  /** DR18 t3 (migración 0060); opcionales: sin la migración todo queda como antes. */
  depositMode?: DepositMode | null;
  enrollmentDiscountPercent?: number | null;
  enrollmentDiscountUntil?: string | null;
};

export type ConditionItem = {
  key: "initial_payment" | "deposit" | "enrollment" | "minimum_stay" | "adjustment" | "advance_booking";
  icon: string;
  label: string;
  value: string;
  /** Aclaración corta bajo el valor. */
  help: string;
  /** Monto en USD a convertir a ARS referencial (la UI agrega `ExchangeRateNote`). */
  arsFromUsd: number | null;
  /** Texto chico que se suma al valor ("única vez", "anual"). */
  valueNote?: string;
};

/** "6 meses" / "1 mes". */
export function monthsLabel(months: number): string {
  return `${months} ${months === 1 ? "mes" : "meses"}`;
}

export type InitialPaymentDisplay = { kind: "first_month" } | { kind: "fixed"; usd: number } | { kind: "enrollment_only" } | { kind: "deposit_only" };

/**
 * Pago inicial para reservar tal como lo muestra la ficha: primer mes o monto fijo. Único punto de lectura de
 * `InitialPaymentConfig` en la ficha (condiciones, card y "Qué pagás y a quién"); la regla de "monto fijo
 * inválido cae al primer mes" sale de `resolveInitialPaymentUsd`, la misma que usa el server.
 */
export function describeInitialPayment(config: InitialPaymentConfig): InitialPaymentDisplay {
  // Con una tarifa imposible (-1) `resolveInitialPaymentUsd` solo devuelve un valor > 0 si hay monto fijo válido.
  if (config.mode === "enrollment_only") return { kind: "enrollment_only" };
  if (config.mode === "deposit_only") return { kind: "deposit_only" };
  const fixed = resolveInitialPaymentUsd(config, -1);
  return fixed > 0 ? { kind: "fixed", usd: fixed } : { kind: "first_month" };
}

export function buildConditionItems(input: FichaConditionsInput, today: string = todayIso()): ConditionItem[] {
  const items: ConditionItem[] = [];

  // Pago inicial para reservar (D7/H08): primer mes por defecto o monto fijo.
  const initial = describeInitialPayment(input.initialPayment);
  items.push(
    initial.kind === "enrollment_only"
      ? {
          key: "initial_payment",
          icon: "payments",
          label: "Para reservar",
          value: "Matrícula",
          help: "Pago inicial a la residencia: la matrícula. La renta se paga mes a mes.",
          arsFromUsd: null,
        }
      : initial.kind === "deposit_only"
      ? {
          key: "initial_payment",
          icon: "payments",
          label: "Para reservar",
          value: "Depósito",
          help: "Pago inicial a la residencia: el depósito (reembolsable). La renta se paga mes a mes.",
          arsFromUsd: null,
        }
      : initial.kind === "fixed"
      ? {
          key: "initial_payment",
          icon: "payments",
          label: "Para reservar",
          value: formatUsd(initial.usd),
          help: "Monto fijo que pide la residencia para reservar.",
          arsFromUsd: initial.usd,
        }
      : {
          key: "initial_payment",
          icon: "payments",
          label: "Para reservar",
          value: "Primer mes",
          help: "Pago inicial a la residencia: el mes del tipo que elijas.",
          arsFromUsd: null,
        },
  );

  if (input.depositMode) {
    items.push({
      key: "deposit",
      icon: "savings",
      label: "Depósito",
      value: depositModeLabel(input.depositMode),
      help: "Reembolsable al irte si no hay daños.",
      arsFromUsd: null,
    });
  } else if (input.depositUsd != null && input.depositUsd > 0) {
    items.push({
      key: "deposit",
      icon: "savings",
      label: "Depósito",
      value: formatUsd(input.depositUsd),
      help: "Reembolsable al irte si no hay daños.",
      arsFromUsd: input.depositUsd,
    });
  }

  // `enrollment_fee_mode = null` es "no cobra matrícula" (DF4). Un dato inconsistente (`unknown`) omite la fila.
  const enrollment = describeEnrollmentFee(input);
  const frequencyNote = input.enrollmentFeeFrequency === "annual" ? "anual" : "única vez";
  // DR18 t3: descuento de matrícula vigente (con fecha de fin si la hay). Solo texto: el monto final lo calcula el desglose de la solicitud.
  const discountPercent = input.enrollmentDiscountPercent ?? 0;
  const discountActive = discountPercent > 0 && isWithinWindow({ endsOn: input.enrollmentDiscountUntil ?? null }, today);
  const discountNote = discountActive
    ? ` ${discountPercent >= 100 ? "Hoy está bonificada (sin costo)" : `Hoy tiene ${discountPercent}% de descuento`}${
        input.enrollmentDiscountUntil ? ` hasta el ${formatDateOnly(input.enrollmentDiscountUntil)}` : ""
      }.`
    : "";
  if (enrollment.kind === "none") {
    items.push({
      key: "enrollment",
      icon: "badge",
      label: "Matrícula",
      value: "No cobra",
      help: "Esta residencia no cobra cargo de ingreso.",
      arsFromUsd: null,
    });
  } else if (enrollment.kind === "one_month") {
    items.push({
      key: "enrollment",
      icon: "badge",
      label: "Matrícula",
      value: "1 mes de renta",
      valueNote: frequencyNote,
      help: `Cargo administrativo de ingreso, igual a un mes del tipo que elijas.${discountNote}`,
      arsFromUsd: null,
    });
  } else if (enrollment.kind === "fixed") {
    items.push({
      key: "enrollment",
      icon: "badge",
      label: "Matrícula",
      value: formatUsd(enrollment.usd),
      valueNote: frequencyNote,
      help: `Cargo administrativo de ingreso.${discountNote}`,
      arsFromUsd: enrollment.usd,
    });
  }

  if (input.minimumStayMonths != null && input.minimumStayMonths > 0) {
    items.push({
      key: "minimum_stay",
      icon: "event_available",
      label: "Estadía mínima",
      value: monthsLabel(input.minimumStayMonths),
      help: "Podés pedir una estadía más larga en la solicitud.",
      arsFromUsd: null,
    });
  }

  const adjustment = adjustmentPolicyCopy(input.adjustmentPolicy);
  if (adjustment) {
    items.push({
      key: "adjustment",
      icon: "trending_up",
      label: "Ajuste de la tarifa",
      value: adjustment.label,
      help: adjustment.help,
      arsFromUsd: null,
    });
  }

  if (input.emptyMonthChargePercent != null && input.emptyMonthChargePercent > 0) {
    items.push({
      key: "advance_booking",
      icon: "hourglass_top",
      label: "Si reservás con anticipación",
      value: `${input.emptyMonthChargePercent}% por mes`,
      help: `Solo si reservás con ingreso diferido y la plaza queda realmente vacía entre que está disponible y tu ingreso (hasta ${MAX_EMPTY_MONTHS} meses). La residencia te guarda la plaza y ese tiempo se cobra en proporción a los días: más de 15 días extra cuentan como un mes y 15 o menos como medio mes. Si ingresás el primer día disponible, o la plaza está ocupada, no se cobra.`,
      arsFromUsd: null,
    });
  }

  return items;
}

const GENDER_LABEL: Record<string, string> = { mixto: "mixta", solo_hombres: "solo hombres", solo_mujeres: "solo mujeres" };
const BATHROOM_LABEL: Record<string, string> = { privado: "baño privado", compartido: "baño compartido" };

/** "2 personas por habitación · mixta · baño compartido": solo lo que está cargado. */
export function roomTypeSubtitle(input: {
  capacityPerRoom: number | null | undefined;
  genderPolicy: string | null | undefined;
  bathroomType: string | null | undefined;
  /** Resumen por habitación («1 masculina, 1 femenina»): si viene, reemplaza al género del tipo. */
  genderSummary?: string | null;
}): string {
  const parts: string[] = [];
  const capacity = input.capacityPerRoom != null ? Number(input.capacityPerRoom) : null;
  if (capacity != null && Number.isFinite(capacity) && capacity > 0) {
    parts.push(`${capacity} ${capacity === 1 ? "persona" : "personas"} por habitación`);
  }
  if (input.genderSummary) parts.push(input.genderSummary);
  else if (input.genderPolicy && GENDER_LABEL[input.genderPolicy]) parts.push(GENDER_LABEL[input.genderPolicy]);
  if (input.bathroomType && BATHROOM_LABEL[input.bathroomType]) parts.push(BATHROOM_LABEL[input.bathroomType]);
  return parts.join(" · ");
}
