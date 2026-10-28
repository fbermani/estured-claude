import { isMissingSchemaError } from "@/lib/stayChange/schema";

/** Columnas del mes vacío confirmado en `application_snapshots` (migraciones 0061/0062). */
export const EMPTY_MONTH_COLUMNS = "empty_months_charge_usd, empty_months_count";

/**
 * Lee un snapshot con las columnas del mes vacío y, si todavía no existen en este entorno (0061 sin aplicar), repite la consulta sin ellas:
 * las pantallas siguen funcionando como antes y el mes vacío simplemente no se muestra. Cualquier otro error se devuelve tal cual.
 */
export async function withEmptyMonthColumns<T>(
  base: string,
  run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string | null; message?: string | null } | null }>,
): Promise<{ data: T | null; error: { code?: string | null; message?: string | null } | null }> {
  const first = await run(`${base}, ${EMPTY_MONTH_COLUMNS}`);
  if (first.error && isMissingSchemaError(first.error)) return run(base);
  return first;
}

/** Formato de la cantidad de meses vacíos con coma decimal (1 → «1 mes», 1,5 → «1,5 meses», 0,5 → «0,5 mes»). */
export function formatEmptyMonthsCount(count: number): string {
  const text = Number.isInteger(count) ? String(count) : String(count).replace(".", ",");
  return `${text} ${count > 1 ? "meses" : "mes"}`;
}
