/** Una cuadra porteña mide ~100 m. La ficha muestra distancias en cuadras (línea recta, aproximadas). */
const METERS_PER_BLOCK = 100;

/** Cuadras aproximadas para una distancia en km; mínimo 1 para no mostrar «0 cuadras». */
export function kmToBlocks(km: number): number {
  if (!Number.isFinite(km) || km < 0) return 0;
  return Math.max(1, Math.round((km * 1000) / METERS_PER_BLOCK));
}

/** «~6 cuadras» / «~1 cuadra». */
export function formatBlocks(km: number): string {
  const n = kmToBlocks(km);
  return `~${n} ${n === 1 ? "cuadra" : "cuadras"}`;
}
