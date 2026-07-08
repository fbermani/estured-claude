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
  getReferenceUsdArsRate(): Promise<ExchangeRateResult>;
}

const MONEDAPI_URL = "https://monedapi.ar/api/v2/usd/blue";

export class MonedApiProvider implements ExchangeRateProvider {
  async getReferenceUsdArsRate(): Promise<ExchangeRateResult> {
    const res = await fetch(MONEDAPI_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`monedapi.ar respondió ${res.status}`);
    }
    const data = (await res.json()) as { sell?: unknown };
    if (typeof data.sell !== "number" || !Number.isFinite(data.sell) || data.sell <= 0) {
      throw new Error("monedapi.ar: respuesta sin valor de venta válido");
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
