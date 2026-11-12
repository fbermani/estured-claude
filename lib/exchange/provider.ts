import "server-only";

/**
 * ExchangeRateProvider (docs/11 §14.2) — fuente confirmada: monedapi.ar,
 * dólar blue, valor de venta (docs/00 §13.2).
 */
export interface ExchangeRateResult {
  arsPerUsd: number;
  source: string;
  rateType: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface ExchangeRateProvider {
  /** `lastKnownArsPerUsd`: último valor conocido, para rechazar saltos implausibles (±50 %). */
  getReferenceUsdArsRate(lastKnownArsPerUsd?: number | null): Promise<ExchangeRateResult>;
}

const FETCH_TIMEOUT_MS = 5000;
/** Sin valor previo: rango absoluto razonable de ARS por USD. */
const ABSOLUTE_MIN = 1;
const ABSOLUTE_MAX = 100_000;
/** Con valor previo: variación máxima aceptada respecto del último valor conocido. */
const MAX_DEVIATION = 0.5;

/** Valor de cotización plausible: finito, > 0 y, si hay referencia, dentro de ±50 %; si no, dentro del rango absoluto. */
export function isPlausibleRate(value: unknown, lastKnown?: number | null): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
  if (typeof lastKnown === "number" && Number.isFinite(lastKnown) && lastKnown > 0) {
    return value >= lastKnown * (1 - MAX_DEVIATION) && value <= lastKnown * (1 + MAX_DEVIATION);
  }
  return value >= ABSOLUTE_MIN && value <= ABSOLUTE_MAX;
}

const MONEDAPI_URL = "https://monedapi.ar/api/v2/usd/blue";

export class MonedApiProvider implements ExchangeRateProvider {
  async getReferenceUsdArsRate(lastKnownArsPerUsd?: number | null): Promise<ExchangeRateResult> {
    const res = await fetch(MONEDAPI_URL, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`monedapi.ar respondió ${res.status}`);
    }
    const data = (await res.json()) as { sell?: unknown };
    if (!isPlausibleRate(data.sell, lastKnownArsPerUsd)) {
      throw new Error("monedapi.ar: respuesta sin valor de venta válido o fuera de rango");
    }
    return {
      arsPerUsd: data.sell,
      source: "monedapi.ar",
      rateType: "blue_sell",
      sourceUrl: MONEDAPI_URL,
      fetchedAt: new Date().toISOString(),
    };
  }
}
