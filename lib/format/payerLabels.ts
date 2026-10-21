/** Condición frente al IVA de quien paga el fee (misma lista que los formularios del estudiante). */
const IVA_LABELS: Record<string, string> = {
  consumidor_final: "Consumidor final",
  responsable_inscripto: "Responsable inscripto",
  monotributista: "Monotributista",
  exento: "Exento",
};

export function ivaConditionLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return IVA_LABELS[value] ?? "—";
}

const CHANNEL_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  virtual_wallet: "Billetera virtual",
  bank_deposit: "Depósito bancario",
  mercado_pago: "Mercado Pago",
  other: "Otro",
};

/** `payment_channel` es texto libre del estudiante ("transferencia") o una clave interna ("transfer"). */
export function paymentChannelLabel(value: string | null | undefined): string {
  const text = value?.trim();
  if (!text) return "—";
  return CHANNEL_LABELS[text] ?? text;
}
