/** Normaliza texto para búsqueda: sin tildes, minúsculas. Seguro para servidor y cliente. */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
