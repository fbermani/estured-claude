/**
 * Formatos de fecha para marcas de tiempo (`timestamptz`) — H29. Siempre en
 * hora de Buenos Aires: el servidor corre en UTC y sin `timeZone` explícito
 * un evento de las 22:00 locales se mostraba con el día siguiente.
 * Las fechas date-only ("YYYY-MM-DD") van por `formatDateOnly`.
 */
const TZ = "America/Argentina/Buenos_Aires";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "20/01/2027" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "20/01/2027, 09:26" (sin segundos). */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
