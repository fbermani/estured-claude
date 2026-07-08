/**
 * Tipo de cambio mock del ciclo fundacional.
 *
 * En producción la fuente es monedapi.ar (dólar blue, valor venta) vía
 * ExchangeRateProvider con tabla diaria y snapshot (docs/00 §13,
 * docs/11 §14). Este valor fijo existe solo para que la UI muestre el
 * patrón obligatorio "USD + ARS referencial".
 */
export const MOCK_EXCHANGE_RATE_ARS_PER_USD = 1480;

export function usdToArsReferencial(usd: number): number {
  // Redondeo simple para el mock; la regla oficial de redondeo vive en
  // docs/00 §13.5 y se implementa junto con ExchangeRateProvider.
  return Math.round(usd * MOCK_EXCHANGE_RATE_ARS_PER_USD);
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
