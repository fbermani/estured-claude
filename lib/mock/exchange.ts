/**
 * Último recorte de degradación del tipo de cambio (docs/00 §13, docs/11
 * §14): `lib/exchange/rate.ts` la usa solo si Supabase y monedapi.ar no
 * responden y no hay ningún valor histórico en `exchange_rates`. La UI
 * de producto nunca debe importar esta constante directamente — usar
 * `getCurrentExchangeRate()` + `usdToArs()`.
 */
export const MOCK_EXCHANGE_RATE_ARS_PER_USD = 1480;

/** Conversión pura USD → ARS con la cotización vigente ya resuelta. */
export function usdToArs(usd: number, arsPerUsd: number): number {
  return Math.round(usd * arsPerUsd);
}

export function formatUsd(usd: number): string {
  return `USD ${usd.toLocaleString("es-AR")}`;
}

export function formatArs(ars: number): string {
  return `ARS ${ars.toLocaleString("es-AR")}`;
}

/** Docs/00 §13.5 / docs/06 §3.3: tarifas USD terminan en 0 o 5. */
export function roundUsd(value: number): number {
  return Math.round(value / 5) * 5;
}

/** Docs/00 §13.5 / docs/06 §3.3: tarifas ARS terminan en 500 o 000. */
export function roundArs(value: number): number {
  return Math.round(value / 500) * 500;
}
