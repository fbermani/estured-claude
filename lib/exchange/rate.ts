import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MonedApiProvider } from "@/lib/exchange/provider";
import { MOCK_EXCHANGE_RATE_ARS_PER_USD } from "@/lib/mock/exchange";

export type CurrentExchangeRate = {
  arsPerUsd: number;
  source: string;
  rateDate: string;
  manuallyOverridden: boolean;
};

type RateRow = {
  official_exchange_rate_ars_per_usd: number;
  source_name: string;
  rate_date: string;
  manually_overridden: boolean;
};

const provider = new MonedApiProvider();

function toResult(row: RateRow): CurrentExchangeRate {
  return {
    arsPerUsd: Number(row.official_exchange_rate_ars_per_usd),
    source: row.source_name,
    rateDate: row.rate_date,
    manuallyOverridden: row.manually_overridden,
  };
}

/** Fecha de hoy en huso horario de Argentina (evita corrimientos por UTC). */
function todayArDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

const RATE_COLUMNS = "official_exchange_rate_ars_per_usd, source_name, rate_date, manually_overridden";

/**
 * Tipo de cambio vigente (docs/00 §13, docs/11 §14): caché diaria en
 * `exchange_rates`, con `monedapi.ar` como fuente y degradación en
 * cascada si la fuente o Supabase no responden (mismo patrón que
 * `getSupabaseAdmin()` devolviendo null — nunca lanza, se degrada).
 *
 * Prioriza, para la fecha de hoy: override manual más reciente >
 * fila automática del día > último valor conocido (cualquier fecha) >
 * constante mock como último recurso.
 */
export async function getCurrentExchangeRate(): Promise<CurrentExchangeRate> {
  const admin = getSupabaseAdmin();
  const today = todayArDate();

  if (!admin) {
    return {
      arsPerUsd: MOCK_EXCHANGE_RATE_ARS_PER_USD,
      source: "mock (sin conexión a Supabase)",
      rateDate: today,
      manuallyOverridden: false,
    };
  }

  const { data: existing } = await admin
    .from("exchange_rates")
    .select(RATE_COLUMNS)
    .eq("rate_date", today)
    .order("manually_overridden", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return toResult(existing);

  try {
    const fetched = await provider.getReferenceUsdArsRate();
    const { data: inserted, error } = await admin
      .from("exchange_rates")
      .insert({
        rate_date: today,
        base_currency: "USD",
        quote_currency: "ARS",
        official_exchange_rate_ars_per_usd: fetched.arsPerUsd,
        source_name: fetched.source,
        source_url: fetched.sourceUrl,
        rate_type: fetched.rateType,
        fetched_at: fetched.fetchedAt,
        manually_overridden: false,
      })
      .select(RATE_COLUMNS)
      .single();
    if (!error && inserted) return toResult(inserted);

    // Carrera entre requests concurrentes (unique de rate_date): otra ya
    // insertó la fila del día, leemos la que ganó en vez de fallar.
    const { data: retry } = await admin
      .from("exchange_rates")
      .select(RATE_COLUMNS)
      .eq("rate_date", today)
      .order("manually_overridden", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (retry) return toResult(retry);

    return { arsPerUsd: fetched.arsPerUsd, source: fetched.source, rateDate: today, manuallyOverridden: false };
  } catch (error) {
    console.error("[exchange-rate] monedapi.ar falló:", error);
    const { data: lastKnown } = await admin
      .from("exchange_rates")
      .select(RATE_COLUMNS)
      .order("rate_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastKnown) return toResult(lastKnown);

    return {
      arsPerUsd: MOCK_EXCHANGE_RATE_ARS_PER_USD,
      source: "mock (monedapi.ar sin respuesta y sin histórico en DB)",
      rateDate: today,
      manuallyOverridden: false,
    };
  }
}
