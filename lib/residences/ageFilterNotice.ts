/**
 * DR51: rótulo de `/search` cuando el filtro de edad (DR14) oculta residencias a un estudiante con fecha de nacimiento.
 * `hidden` = residencias publicadas que no aceptan su edad a la fecha de referencia. Null si no hay nada oculto.
 */
export function ageFilterNotice(hidden: number, withIngresoDate: boolean): string | null {
  if (!Number.isFinite(hidden) || hidden <= 0) return null;
  const when = withIngresoDate ? " a la fecha de ingreso elegida" : "";
  const rest = hidden === 1 ? "1 más tiene otro rango de edad" : `${hidden} más tienen otro rango de edad`;
  return `Mostramos las residencias que aceptan tu edad${when}. ${rest}.`;
}
