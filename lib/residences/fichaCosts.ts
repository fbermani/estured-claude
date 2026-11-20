/**
 * Cuadro de costos del capítulo «Qué incluye y qué se paga aparte» de la ficha (propuesta A, fase 4). Lógica pura: arma qué filas
 * lleva «Se paga aparte» (a la residencia / a EstuRed) a partir de las condiciones que ya calcula la página, y define los tres pasos
 * de «Cómo y cuándo pagás». Los componentes solo dibujan lo que sale de acá.
 *
 * Moneda: siempre `formatUsd` («USD 190», nunca «US$») y, junto a cada monto en USD, su referencia en ARS (`usdToArsRounded`) que la UI
 * acompaña con `ExchangeRateNote`. Nada se carga a mano: si un dato falta, la fila se omite o dice «A coordinar», nunca se inventa.
 */
import { FEE_PERCENT } from "@/lib/applications/fee";
import { resolveReservationMoney, todayIso } from "@/lib/applications/reservationMoney";
import { buildConditionRows, type ConditionRow } from "@/lib/residences/conditionCards";
import { EMPTY_MONTH_CARD_LINE } from "@/lib/residences/emptyMonthCopy";
import { adjustmentPolicyCopy, type FichaConditionsInput } from "@/lib/residences/fichaConditions";
import { describeEnrollmentFee } from "@/lib/residences/enrollmentFee";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";

/** Los tres pasos de «Cómo y cuándo pagás». Textos aprobados por el dueño: no se agregan ni se reordenan sin decisión de producto. */
export const PAYMENT_STEPS: readonly { title: string; text: string }[] = [
  { title: "Hoy", text: "Pedís la habitación." },
  { title: "Si la residencia confirma", text: "Pagás el fee de EstuRed y el primer pago a la residencia." },
  { title: "Cada mes", text: "Alquiler directo a la residencia." },
];

/** Nota que acompaña a la línea de tiempo. */
export const PAYMENT_STEPS_NOTE = "Montos estimados. El total final lo ves antes de confirmar y no cambia sin tu aceptación.";

export type PaidRow = {
  key: "initial_payment" | "deposit" | "enrollment" | "empty_month" | "fee";
  label: string;
  /** Aclaración corta bajo el rótulo. */
  help: string;
  /** Valor principal («USD 300», «Primer mes», «desde USD 57»). */
  value: string;
  /** Texto chico pegado al valor («única vez»). */
  valueNote?: string;
  /** Referencia en pesos («≈ ARS 444.000»); si existe, la UI agrega `ExchangeRateNote`. */
  ars?: string;
};

export type PaidGroup = { key: "residence" | "estured"; who: string; rows: PaidRow[] };

export type PaidSeparately = {
  groups: PaidGroup[];
  /** Algún renglón trae referencia en pesos: hay que mostrar `ExchangeRateNote showNote`. */
  hasArs: boolean;
  /** Línea de cierre: ajuste de tarifa y matrícula. `null` si no hay nada que decir. */
  footnote: string | null;
};

const arsLabel = (usd: number, arsPerUsd: number) => `≈ ${formatArs(usdToArsRounded(usd, arsPerUsd))}`;

/**
 * Fee de EstuRed «desde»: 5 % de la estadía mínima en el tipo más barato (renta × meses + matrícula neta). Es una cota inferior
 * (por eso «desde» y `floor`). `null` si falta la tarifa o la estadía mínima: ahí la UI dice solo el porcentaje.
 */
export function estimateFeeFromUsd(params: { monthlyUsd: number | null; minimumStayMonths: number | null; enrollmentNetUsd: number }): number | null {
  const { monthlyUsd, minimumStayMonths, enrollmentNetUsd } = params;
  if (monthlyUsd == null || !(monthlyUsd > 0)) return null;
  if (minimumStayMonths == null || !(minimumStayMonths > 0)) return null;
  const base = monthlyUsd * minimumStayMonths + Math.max(0, enrollmentNetUsd);
  return Math.floor(base * FEE_PERCENT);
}

function pickRow(rows: ConditionRow[], key: ConditionRow["key"]): ConditionRow | undefined {
  return rows.find((r) => r.key === key);
}

/** Una fila de «Se paga aparte» a partir de una condición de la ficha (con su referencia en pesos si es un monto en USD). */
function paidRowFromCondition(row: ConditionRow, label: string, key: PaidRow["key"], arsPerUsd: number): PaidRow {
  return {
    key,
    label,
    help: row.help,
    value: row.value,
    ...(row.valueNote ? { valueNote: row.valueNote } : {}),
    ...(row.arsFromUsd != null ? { ars: arsLabel(row.arsFromUsd, arsPerUsd) } : {}),
  };
}

export function buildPaidSeparately(params: {
  conditions: FichaConditionsInput;
  /** Tarifa «desde» (la del tipo más barato con lugar, ya con promoción). `null` si no hay tipos. */
  fromPriceUsd: number | null;
  arsPerUsd: number;
  /** Solo para tests. */
  today?: string;
}): PaidSeparately {
  const { conditions, fromPriceUsd, arsPerUsd } = params;
  const rows = buildConditionRows(conditions, params.today);

  const toResidence: PaidRow[] = [];
  const initial = pickRow(rows, "initial_payment");
  if (initial) toResidence.push(paidRowFromCondition(initial, "Pago inicial para reservar", "initial_payment", arsPerUsd));
  const deposit = pickRow(rows, "deposit");
  if (deposit?.charges) toResidence.push(paidRowFromCondition(deposit, "Depósito", "deposit", arsPerUsd));
  const enrollment = pickRow(rows, "enrollment");
  if (enrollment?.charges) toResidence.push(paidRowFromCondition(enrollment, "Matrícula", "enrollment", arsPerUsd));
  const empty = pickRow(rows, "empty_month");
  if (empty?.charges) {
    toResidence.push({ key: "empty_month", label: "Mes vacío", help: EMPTY_MONTH_CARD_LINE, value: empty.value });
  }

  // Fee de EstuRed: misma resolución de matrícula que el desglose de la solicitud (descuento vigente incluido).
  const money =
    fromPriceUsd != null
      ? resolveReservationMoney({ listMonthlyUsd: fromPriceUsd, conditions, arsPerUsd, today: params.today ?? todayIso() })
      : null;
  const feeUsd = estimateFeeFromUsd({
    monthlyUsd: fromPriceUsd,
    minimumStayMonths: conditions.minimumStayMonths,
    enrollmentNetUsd: money?.enrollment.netUsd ?? 0,
  });
  const percent = `${Math.round(FEE_PERCENT * 100)} %`;
  const feeRow: PaidRow =
    feeUsd != null && feeUsd > 0
      ? {
          key: "fee",
          label: "Fee de EstuRed",
          help: `${percent} del total de la estadía mínima. Solo si la residencia confirma.`,
          value: `desde ${formatUsd(feeUsd)}`,
          ars: arsLabel(feeUsd, arsPerUsd),
        }
      : {
          key: "fee",
          label: "Fee de EstuRed",
          help: "Un porcentaje del total de la estadía. Solo si la residencia confirma.",
          value: percent,
        };

  const groups: PaidGroup[] = [
    ...(toResidence.length > 0 ? [{ key: "residence" as const, who: "A la residencia", rows: toResidence }] : []),
    { key: "estured", who: "A EstuRed", rows: [feeRow] },
  ];

  const adjustment = adjustmentPolicyCopy(conditions.adjustmentPolicy);
  const noEnrollment = describeEnrollmentFee(conditions).kind === "none";
  const footnote = [adjustment?.help, noEnrollment ? "No cobra matrícula." : null].filter(Boolean).join(" ") || null;

  return { groups, hasArs: groups.some((g) => g.rows.some((r) => r.ars)), footnote };
}
