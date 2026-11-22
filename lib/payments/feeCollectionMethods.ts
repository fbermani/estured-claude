import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPaymentSettings } from "@/lib/payments/paymentSettings";
import {
  FEE_FALLBACK_METHOD_KEY,
  compareByCatalog,
  composeSettingsDetails,
  isFeeCurrency,
  type FeeCurrency,
  type FeeMethodChoice,
} from "@/lib/payments/feeCollection";
import { paymentMethodLabel } from "@/lib/payments/paymentMethods";

/**
 * Lectura de los medios con los que EstuRed cobra su fee (`estured_fee_collection_methods`, migración 0105, DR64 (a)). SOLO SERVER: la
 * tabla no tiene policies ni grants, se accede con service role. Los datos de cobro (`details`) nunca salen de acá hacia el cliente:
 * quien arma una pantalla usa `toFeeMethodChoice` (sin datos) o los congela en `instructions_snapshot` al elegir.
 */

export type FeeCollectionMethodRow = {
  id: string;
  method_key: string;
  method_label: string | null;
  details: string;
  currency: FeeCurrency;
  is_enabled: boolean;
  updated_by_user_id: string | null;
  updated_at: string;
};

const COLUMNS = "id, method_key, method_label, details, currency, is_enabled, updated_by_user_id, updated_at";
/** Tabla o columna inexistente: la migración 0105 todavía no está aplicada en ese entorno. */
const SCHEMA_MISSING = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

export type LoadFeeMethodsResult = { ok: true; rows: FeeCollectionMethodRow[] } | { ok: false };

/** Todas las filas (habilitadas o no), en el orden del catálogo. Sin la migración devuelve lista vacía. */
export async function loadFeeCollectionMethods(admin: SupabaseClient): Promise<LoadFeeMethodsResult> {
  const { data, error } = await admin.from("estured_fee_collection_methods").select(COLUMNS);
  if (error) {
    if (SCHEMA_MISSING.has(error.code ?? "")) return { ok: true, rows: [] };
    console.error("[fee-collection] read failed:", error.code, error.message);
    return { ok: false };
  }
  const rows = ((data ?? []) as FeeCollectionMethodRow[]).filter((r) => isFeeCurrency(r.currency));
  return { ok: true, rows: rows.sort((a, b) => compareByCatalog(a.method_key, b.method_key)) };
}

/** Medio que se ofrece al pagador (con sus datos: solo uso del servidor). */
export type OfferedFeeMethod = {
  key: string;
  label: string;
  currency: FeeCurrency;
  details: string;
  /** `payment_settings` como `transfer_ars` mientras no haya ningún medio habilitado. */
  source: "table" | "settings";
};

export type OfferedFeeMethodsResult = { ok: true; methods: OfferedFeeMethod[]; usingFallback: boolean } | { ok: false };

/**
 * Medios habilitados HOY. Respaldo: la cuenta de `payment_settings` como «Transferencia en pesos» (ARS), que es como se cobra el fee antes
 * de DR64, SOLO si la tabla no tiene ninguna fila `transfer_ars` y no hay ningún medio habilitado. Si el superadmin cargó `transfer_ars`
 * (aunque la haya deshabilitado), el respaldo no la resucita: sin medios habilitados el cobro se frena y la pantalla dirige a Soporte.
 * Sin medios y sin cuenta devuelve lista vacía.
 */
export async function loadOfferedFeeMethods(admin: SupabaseClient): Promise<OfferedFeeMethodsResult> {
  const loaded = await loadFeeCollectionMethods(admin);
  if (!loaded.ok) return { ok: false };
  const enabled = loaded.rows.filter((r) => r.is_enabled && r.details.trim().length > 0);
  if (enabled.length > 0) {
    return {
      ok: true,
      usingFallback: false,
      methods: enabled.map((r) => ({
        key: r.method_key,
        label: paymentMethodLabel(r.method_key, r.method_label),
        currency: r.currency,
        details: r.details,
        source: "table" as const,
      })),
    };
  }
  if (loaded.rows.some((r) => r.method_key === FEE_FALLBACK_METHOD_KEY)) return { ok: true, usingFallback: false, methods: [] };
  const settings = await loadPaymentSettings(admin);
  if (!settings) return { ok: true, usingFallback: true, methods: [] };
  return {
    ok: true,
    usingFallback: true,
    methods: [
      {
        key: FEE_FALLBACK_METHOD_KEY,
        label: paymentMethodLabel(FEE_FALLBACK_METHOD_KEY),
        currency: "ARS",
        details: composeSettingsDetails(settings),
        source: "settings",
      },
    ],
  };
}

/** Lo que viaja al cliente: clave, nombre y moneda. Sin datos de cobro. */
export function toFeeMethodChoice(method: OfferedFeeMethod): FeeMethodChoice {
  return { key: method.key, label: method.label, currency: method.currency };
}
