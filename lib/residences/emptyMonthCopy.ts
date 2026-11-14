import { MAX_EMPTY_MONTHS } from "@/lib/applications/emptyMonths";

/**
 * Copy único del «mes vacío» (DR53). Una sola fuente para ficha, desglose, configuración de la residencia y
 * reglamento, para que se explique igual en todos lados. La regla real es la de docs/00 DR18 t3 (segunda
 * corrección): no se inventa otra acá. Es un cargo parcial por guardar la plaza vacía, NO un descuento.
 */

/** Idea central, en una frase y ANTES de los detalles. */
export const EMPTY_MONTH_IDEA =
  "Si reservás para ingresar más adelante y la plaza está libre mientras tanto, la residencia te la guarda: por ese tiempo sin vos adentro (el «mes vacío») se cobra un porcentaje de la renta, no la renta entera.";

/** Una línea para la tarjeta de la ficha (bajo el dato). */
export const EMPTY_MONTH_CARD_LINE = "Solo si reservás con ingreso a futuro";

/** Reglas de cálculo, mismas que usa el servidor. */
export const EMPTY_MONTH_RULES = `Aplica solo si ingresás después del primer día en que la plaza está disponible y la residencia publicó esa disponibilidad. Se cuenta desde que la plaza está libre hasta el día anterior a tu ingreso: cada mes completo suma uno y, si sobran días, más de 15 cuentan como un mes y de 1 a 15 como medio mes (hasta ${MAX_EMPTY_MONTHS} meses). Si ingresás el primer día disponible, o la plaza está ocupada en ese tramo, no se cobra. Cuando la residencia no tiene la disponibilidad confirmada, lo ves como «a confirmar por la residencia» y no se suma al total.`;

/** Ejemplo corto con números: disponible hoy, ingreso en 45 días (1,5 meses vacíos). */
export function emptyMonthExample(percent: number): string {
  const frac = (1.5 * percent) / 100;
  const rent = Number.isInteger(frac) ? String(frac) : String(Math.round(frac * 100) / 100).replace(".", ",");
  return `Ejemplo: la plaza está disponible hoy, ingresás en 45 días y la residencia cobra ${percent} %: son 1,5 meses × ${percent} % = ${rent} ${frac === 1 ? "renta mensual" : "de una renta mensual"}.`;
}
