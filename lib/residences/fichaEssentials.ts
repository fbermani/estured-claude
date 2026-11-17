/**
 * Valores de la franja «Lo esencial» y de los precios «desde» de la ficha (placa, franja, barra móvil). Lógica pura:
 * los textos se componen acá y los componentes solo los dibujan. Todo monto en USD sale con su referencia en ARS
 * (`usdToArsRounded` + `formatArs`, con la cotización que trae la página); nada se carga a mano.
 */
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { describeEnrollmentFee } from "@/lib/residences/enrollmentFee";
import { monthsLabel } from "@/lib/residences/fichaConditions";
import { abbreviateUniversity } from "@/lib/residences/universityLabel";

export type FromPriceLabels = {
  /** «USD 190» */
  usd: string;
  /** «desde USD 190/mes» (la «numeración» de la placa y de la barra móvil) */
  usdPerMonth: string;
  /** «≈ ARS 281.000» (siempre acompaña al monto en USD) */
  ars: string;
};

/** Textos del precio «desde». Moneda: «USD», nunca «US$»; la referencia en ARS va redondeada como en el resto de la ficha. */
export function fromPriceLabels(fromPriceUsd: number, arsPerUsd: number): FromPriceLabels {
  const usd = formatUsd(fromPriceUsd);
  return {
    usd,
    usdPerMonth: `desde ${usd}/mes`,
    ars: `≈ ${formatArs(usdToArsRounded(fromPriceUsd, arsPerUsd))}`,
  };
}

export type EssentialCell = {
  key: "desde" | "habitaciones" | "estadia" | "cerca" | "edad";
  /** Ícono de Material Symbols. */
  icon: string;
  label: string;
  value: string;
  /** Unidad chica pegada al valor («/mes»). */
  unit?: string;
  /** Bajada de una línea. */
  sub?: string;
  /** La bajada es una conversión a pesos: lleva `ExchangeRateNote` al lado. */
  subIsArs?: boolean;
  /** Texto completo para lectores de pantalla / tooltip cuando el visible está abreviado. */
  ariaLabel?: string;
  title?: string;
};

export type EssentialsInput = {
  fromPriceUsd: number | null;
  arsPerUsd: number;
  /** Capacidad por habitación de cada tipo activo (`null` si no está cargada). */
  roomTypes: { capacity: number | null }[];
  minimumStayMonths: number | null;
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  /** Universidad más cercana (nombre completo del listado y distancia en línea recta, km). */
  nearest: { name: string; km: number } | null;
  /** Celda de edades (`buildAgeFacts(...).strip`): rango que admite la residencia y/o promedio de la comunidad. Sin dato, no hay celda. */
  age?: { value: string; unit: string; sub?: string } | null;
};

/** «de 1 a 3 personas» / «para 2 personas» / `undefined` si ningún tipo tiene la capacidad cargada. */
export function capacityRangeLabel(capacities: (number | null)[]): string | undefined {
  const known = capacities.filter((c): c is number => typeof c === "number" && c > 0);
  if (known.length === 0) return undefined;
  const min = Math.min(...known);
  const max = Math.max(...known);
  if (min === max) return `para ${min} ${min === 1 ? "persona" : "personas"}`;
  return `de ${min} a ${max} personas`;
}

/** «1,9 km» (coma decimal, un decimal). */
export function formatKm(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/**
 * Las celdas de la franja, en orden: Desde, Habitaciones, Estadía mínima, Cerca de y Edades. Una celda sin dato se omite (nunca se muestra un
 * valor inventado). La matrícula solo se afirma como «sin matrícula» cuando la residencia declaró que no cobra (`describeEnrollmentFee`).
 */
export function buildEssentialCells(input: EssentialsInput): EssentialCell[] {
  const cells: EssentialCell[] = [];

  if (input.fromPriceUsd != null) {
    const p = fromPriceLabels(input.fromPriceUsd, input.arsPerUsd);
    cells.push({ key: "desde", icon: "sell", label: "Desde", value: p.usd, unit: "/mes", sub: p.ars, subIsArs: true });
  }

  const types = input.roomTypes.length;
  if (types > 0) {
    cells.push({
      key: "habitaciones",
      icon: "bed",
      label: "Habitaciones",
      value: `${types} ${types === 1 ? "tipo" : "tipos"}`,
      sub: capacityRangeLabel(input.roomTypes.map((t) => t.capacity)),
    });
  }

  if (input.minimumStayMonths != null && input.minimumStayMonths > 0) {
    const fee = describeEnrollmentFee({ enrollmentFeeMode: input.enrollmentFeeMode, enrollmentFeeUsd: input.enrollmentFeeUsd });
    cells.push({
      key: "estadia",
      icon: "event_available",
      label: "Estadía mínima",
      value: monthsLabel(input.minimumStayMonths),
      sub: fee.kind === "none" ? "sin matrícula" : fee.kind === "unknown" ? undefined : "con matrícula",
    });
  }

  if (input.nearest) {
    const km = formatKm(input.nearest.km);
    cells.push({
      key: "cerca",
      icon: "school",
      label: "Cerca de",
      value: km,
      sub: abbreviateUniversity(input.nearest.name),
      title: input.nearest.name,
      ariaLabel: `Cerca de: a ${km.replace(" km", "")} kilómetros de ${input.nearest.name}`,
    });
  }

  if (input.age) {
    cells.push({
      key: "edad",
      icon: "groups",
      label: "Edades",
      value: input.age.value,
      unit: input.age.unit,
      sub: input.age.sub,
      ariaLabel: `Edades: ${input.age.value} ${input.age.unit}${input.age.sub ? `, ${input.age.sub}` : ""}`,
    });
  }

  return cells;
}
