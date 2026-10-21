/**
 * Formatea una columna `date` de Postgres (string "YYYY-MM-DD", sin hora)
 * a "DD/MM/YYYY" sin pasar por `Date`/`toLocaleDateString` — hacerlo corre
 * el día hacia atrás en husos detrás de UTC (Argentina, UTC-3) porque
 * "YYYY-MM-DD" se parsea como medianoche UTC.
 *
 * Es el ÚNICO formato de fechas date-only de la app (auditoría 2026-10-20,
 * H29): se re-exporta desde `lib/students/contractEnd.ts`. Devuelve "—" si
 * no hay fecha o no tiene la forma "YYYY-MM-DD".
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;

export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const match = DATE_ONLY.exec(dateStr);
  if (!match) return "—";
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "—";
  return `${match[3]}/${match[2]}/${match[1]}`;
}
