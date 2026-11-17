/**
 * Etiqueta «Nuevo» de «Compartir ficha» en el menú de la residencia. Se apaga sola al llegar la fecha de corte (no depende de
 * localStorage ni de la base): para quitarla antes o después, cambiar esta constante. Sin `server-only`: lógica pura.
 */
export const SHARE_NEW_UNTIL = "2026-12-31";

/** `true` hasta el final del día de corte (hora de Buenos Aires). */
export function isShareFeatureNew(now: Date = new Date()): boolean {
  return now.getTime() <= Date.parse(`${SHARE_NEW_UNTIL}T23:59:59-03:00`);
}
