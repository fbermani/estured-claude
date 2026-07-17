/**
 * Cálculo de "meses vacíos" (referencia de configuración, migración
 * 0025): meses calendario COMPLETOS entre la solicitud y la fecha de
 * ingreso, con tope de 3 (la referencia: "al reservar un cupo futuro
 * (máximo 3 meses)"). La residencia cobra `empty_month_charge_percent`
 * % de la renta por cada uno. Archivo sin "server-only" a propósito:
 * lo usan la previa del cliente (ApplyForm) y el snapshot del server.
 */
export const MAX_EMPTY_MONTHS = 3;

export function computeEmptyMonths(desiredStartDate: string, from: Date = new Date()): number {
  const [y, m] = desiredStartDate.split("-").map(Number);
  if (!y || !m) return 0;
  const raw = (y - from.getFullYear()) * 12 + (m - 1 - from.getMonth()) - 1;
  return Math.min(MAX_EMPTY_MONTHS, Math.max(0, raw));
}

export function emptyMonthsChargeUsd(params: {
  desiredStartDate: string;
  monthlyPriceUsd: number;
  chargePercent: number | null;
  from?: Date;
}): { months: number; chargeUsd: number } {
  const months = computeEmptyMonths(params.desiredStartDate, params.from);
  if (params.chargePercent == null || params.chargePercent <= 0 || months === 0) {
    return { months, chargeUsd: 0 };
  }
  return { months, chargeUsd: months * params.monthlyPriceUsd * (params.chargePercent / 100) };
}
