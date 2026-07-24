/**
 * `dateStr` es una columna `date` (sin hora) — parsear con `new Date(dateStr)`
 * la interpreta como medianoche UTC, y formatear después en un huso horario
 * negativo (Argentina) corre el día mostrado uno para atrás. Se arma y se
 * formatea todo en UTC para que el cálculo de fecha no dependa del huso del
 * usuario.
 */
export function addMonthsDateOnly(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, day));
  return result.toLocaleDateString("es-AR", { timeZone: "UTC" });
}

export function daysRemaining(startDateStr: string, months: number): number {
  const [year, month, day] = startDateStr.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1 + months, day));
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
