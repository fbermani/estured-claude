import { buildConditionItems, type ConditionItem, type FichaConditionsInput } from "@/lib/residences/fichaConditions";

/**
 * Tarjetas de «Tarifas y condiciones» de la ficha (DR53, reemplaza «seis tarjetas fijas» de DR30 §4):
 * las tarjetas muestran SOLO lo que cobra algo; las seis condiciones completas viven en un único expander.
 * Lógica pura (sin JSX) para poder testear qué se muestra según lo que cobra la residencia.
 */

export type ConditionKey = "initial_payment" | "enrollment" | "deposit" | "adjustment" | "empty_month" | "documents";

export const COORDINAR = "A coordinar con la residencia";

export type ConditionRow = {
  key: ConditionKey;
  title: string;
  /** Si cobra algo (o es el pago inicial). Solo estas van como tarjeta. */
  charges: boolean;
  /** Valor largo, para el expander («No cobra», «A coordinar…»). */
  value: string;
  help: string;
  /** Monto en USD a convertir a ARS referencial (la UI agrega la nota de cotización). */
  arsFromUsd?: number | null;
  /** Texto chico junto al valor («única vez»). */
  valueNote?: string;
  /** Datos para la tarjeta de mes vacío. */
  emptyPercent?: number;
};

function pick(items: ConditionItem[], key: ConditionItem["key"]) {
  return items.find((i) => i.key === key);
}

/** Las seis condiciones, en orden fijo, con `charges` según lo que cobra la residencia. */
export function buildConditionRows(input: FichaConditionsInput, today?: string): ConditionRow[] {
  const items = buildConditionItems(input, today);
  const initial = pick(items, "initial_payment");
  const enrollment = pick(items, "enrollment");
  const deposit = pick(items, "deposit");
  const adjustment = pick(items, "adjustment");
  const percent = input.emptyMonthChargePercent;
  const chargesEmpty = percent != null && percent > 0;

  return [
    {
      key: "initial_payment",
      title: "Para reservar",
      charges: true,
      value: initial?.value ?? COORDINAR,
      help: initial?.help ?? "El pago inicial lo define la residencia.",
      arsFromUsd: initial?.arsFromUsd ?? null,
    },
    {
      key: "enrollment",
      title: "Matrícula",
      charges: !!enrollment && enrollment.value !== "No cobra",
      value: enrollment?.value ?? "No cobra",
      help: enrollment?.help ?? "Esta residencia no cobra cargo de ingreso.",
      arsFromUsd: enrollment?.arsFromUsd ?? null,
      valueNote: enrollment?.valueNote,
    },
    {
      key: "deposit",
      title: "Depósito",
      charges: !!deposit,
      value: deposit?.value ?? "No cobra",
      help: deposit?.help ?? "Esta residencia no pide depósito.",
      arsFromUsd: deposit?.arsFromUsd ?? null,
    },
    {
      key: "adjustment",
      title: "Ajuste de tarifa",
      charges: false,
      value: adjustment?.value ?? COORDINAR,
      help: adjustment?.help ?? "La residencia te indica cada cuánto puede actualizar la tarifa.",
    },
    {
      key: "empty_month",
      title: "Mes vacío",
      charges: chargesEmpty,
      value: chargesEmpty ? `${percent} % de la renta` : "No cobra mes vacío",
      help: "",
      emptyPercent: chargesEmpty ? percent : undefined,
    },
    {
      key: "documents",
      title: "Documentos para admisión",
      charges: false,
      value: COORDINAR,
      help: "Los documentos que necesita la residencia para admitirte los define ella y te los pide una vez que tu solicitud avanza.",
    },
  ];
}

/** Solo las tarjetas que cobran algo (siempre incluye «Para reservar»). */
export function visibleConditionCards(rows: ConditionRow[]): ConditionRow[] {
  return rows.filter((r) => r.charges);
}
