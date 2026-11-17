import { EsturedSeal } from "@/components/brand/EsturedSeal";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { fromPriceLabels } from "@/lib/residences/fichaEssentials";
import { plateTitleFontSize } from "@/lib/residences/fichaHero";

/**
 * La «placa porteña» de la ficha (propuesta A): el nombre de la residencia en una placa forest-ink con doble filete, el barrio, el
 * precio «desde» como la «numeración» del cartel (con su referencia en ARS) y el sello «Verificada». Se repite en el hero, en el
 * panel de solicitud y en la barra móvil para que el link compartido y la página se reconozcan como lo mismo.
 *
 * Variantes:
 * - `hero`: la placa grande sobre la portada. El h1 de la página vive acá.
 * - `panel`: placa chica sobre el panel de solicitud (nombre, barrio y sello mini).
 * - `bar`: «numeración» de la barra inferior móvil (filete + precio «desde» + ARS).
 *
 * El sello NO PUEDE TAPAR el precio, la placa ni la CTA, en ningún ancho (320 a 1440 px). Se garantiza por ESTRUCTURA, no por
 * posicionamiento: la placa es una columna de tres regiones apiladas (`data-plate-region`): «top» (barrio y precio), el nombre y
 * «foot» (texto de verificación y sello). El sello vive en SU PROPIA columna del carril de abajo, con un ancho que escala con
 * `clamp()` sobre el ancho de la placa (`cqw`); precio y sello nunca comparten fila ni hay ningún elemento `absolute` adentro.
 * `ResidencePlate.test.ts` verifica esa estructura.
 */
export type ResidencePlateProps =
  | { variant: "hero"; name: string; zone: string | null; fromPriceUsd: number | null; arsPerUsd: number }
  | { variant: "panel"; name: string; zone: string | null }
  | { variant: "bar"; fromPriceUsd: number; arsPerUsd: number };

/** Doble filete de la placa: dos aros finos paper al 16 % separados por un aro forest-ink, más la sombra de apoyo. Todo con tokens. */
const PLATE_FRAME =
  "shadow-[inset_0_0_0_1.5px_var(--paper-16),inset_0_0_0_6px_var(--color-forest-ink),inset_0_0_0_7.5px_var(--paper-16),var(--shadow-float)]";
const PLATE_FRAME_MINI =
  "shadow-[inset_0_0_0_1.5px_var(--paper-16),inset_0_0_0_4px_var(--color-forest-ink),inset_0_0_0_5.5px_var(--paper-16)]";

const SOFT = "text-[color:var(--paper-88)]";

export function ResidencePlate(props: ResidencePlateProps) {
  if (props.variant === "bar") return <BarNumbering fromPriceUsd={props.fromPriceUsd} arsPerUsd={props.arsPerUsd} />;
  if (props.variant === "panel") return <PanelPlate name={props.name} zone={props.zone} />;
  return <HeroPlate name={props.name} zone={props.zone} fromPriceUsd={props.fromPriceUsd} arsPerUsd={props.arsPerUsd} />;
}

function HeroPlate({
  name,
  zone,
  fromPriceUsd,
  arsPerUsd,
}: {
  name: string;
  zone: string | null;
  fromPriceUsd: number | null;
  arsPerUsd: number;
}) {
  const price = fromPriceUsd != null ? fromPriceLabels(fromPriceUsd, arsPerUsd) : null;
  return (
    // El contenedor `@container` mide el ancho real de la placa: de ahí salen el tamaño del nombre y el del sello (`cqw`).
    <div data-plate="hero" className="@container w-full min-w-0 max-w-[760px] min-[900px]:flex-1">
      <div
        className={`rounded-field bg-forest-ink px-[18px] pb-4 pt-[18px] text-paper min-[768px]:px-[30px] min-[768px]:pb-[22px] min-[768px]:pt-[26px] ${PLATE_FRAME}`}
      >
        {/* Región superior: barrio a la izquierda, «numeración» (precio) a la derecha. Si no entran en una línea, el precio baja. */}
        <div data-plate-region="top" className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-1">
          {zone && <p className={`text-sm font-semibold sm:text-base ${SOFT}`}>{zone}, CABA</p>}
          {price && (
            <div data-plate-region="price" className="ml-auto flex flex-col items-end gap-0.5 text-right">
              <span className="rounded-field bg-paper px-2.5 py-0.5 text-[15px] font-bold tabular-nums text-forest-ink sm:text-base">
                {price.usdPerMonth}
              </span>
              <span className={`flex items-center text-[13px] font-semibold tabular-nums ${SOFT}`}>
                {price.ars}
                <ExchangeRateNote compact onDark align="end" />
              </span>
            </div>
          )}
        </div>

        {/* El tamaño se calcula para que la palabra más larga entre en una línea; la clase es solo el respaldo sin `cqw`. */}
        <h1
          className="mx-1 mb-3.5 mt-2.5 text-4xl font-bold leading-[0.9] text-paper [overflow-wrap:anywhere] sm:text-6xl"
          style={{ fontSize: plateTitleFontSize(name), letterSpacing: "-0.035em" }}
        >
          {name}
        </h1>

        <div aria-hidden="true" className="mx-1 h-[1.5px] bg-[color:var(--paper-16)]" />

        {/* Región inferior: texto de verificación y sello, cada uno en su columna. */}
        <div data-plate-region="foot" className="flex items-center gap-3 px-1 pt-3">
          <p className="min-w-0 flex-1 text-[15px] leading-snug sm:text-base">
            <strong className="font-bold">Verificada por EstuRed:</strong> <span className={SOFT}>la visitamos en persona.</span>
          </p>
          <span
            data-plate-region="seal"
            className="aspect-square shrink-0 [--seal-delay:0.6s]"
            style={{ width: "clamp(5.5rem, 15cqw, 7rem)" }}
          >
            <EsturedSeal tone="cream" stamp size={112} className="size-full" />
          </span>
        </div>
      </div>
    </div>
  );
}

function PanelPlate({ name, zone }: { name: string; zone: string | null }) {
  return (
    <div data-plate="panel" className={`flex items-center gap-3 rounded-field bg-forest-ink px-4 py-3.5 text-paper ${PLATE_FRAME_MINI}`}>
      <div data-plate-region="name" className="min-w-0 flex-1">
        <b className="block font-display text-xl leading-tight [overflow-wrap:anywhere]">{name}</b>
        <span className={`text-[13px] ${SOFT}`}>{zone ? `${zone}, verificada en persona` : "Verificada en persona"}</span>
      </div>
      <span data-plate-region="seal" className="shrink-0">
        <EsturedSeal tone="cream" variant="mini" size={40} />
      </span>
    </div>
  );
}

function BarNumbering({ fromPriceUsd, arsPerUsd }: { fromPriceUsd: number; arsPerUsd: number }) {
  const price = fromPriceLabels(fromPriceUsd, arsPerUsd);
  return (
    <div data-plate="bar" className="flex min-w-0 items-stretch gap-2.5">
      <i aria-hidden="true" className="w-1.5 shrink-0 self-stretch rounded-full bg-forest-ink" />
      <div className="min-w-0 leading-tight">
        <p>
          <span className="block text-xs text-ink-faint">desde</span>
          <b className="font-display text-xl font-bold tabular-nums text-ink">{price.usd}</b>{" "}
          <span className="text-[13px] text-ink-faint">/mes</span>
        </p>
        <p className="flex flex-wrap items-center text-[13px] tabular-nums text-ink-faint">
          {price.ars}
          <ExchangeRateNote compact />
        </p>
      </div>
    </div>
  );
}
