/**
 * Formatea una columna `date` de Postgres (string "YYYY-MM-DD", sin hora)
 * a "DD/MM/YYYY" sin pasar por `Date`/`toLocaleDateString` — hacerlo corre
 * el día hacia atrás en husos detrás de UTC (Argentina, UTC-3) porque
 * "YYYY-MM-DD" se parsea como medianoche UTC.
 */
export function formatDateOnly(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}
