import { EsturedSeal } from "@/components/brand/EsturedSeal";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { fromPriceLabels } from "@/lib/residences/fichaEssentials";
import { PLATE_SEAL_WIDTH, plateTitleFontSize } from "@/lib/residences/fichaHero";

/**
 * La «placa porteña» de la ficha (propuesta A): el nombre de la residencia en una placa forest-ink con doble filete, el barrio, el
 * precio «desde» como la «numeración» del cartel (con su referencia en ARS) y el sello «Verificada». Se repite en el hero, en el
 * panel de solicitud y en la barra móvil para que el link compartido y la página se reconozcan como lo mismo.
 *
 * Variantes:
 * - `hero`: la placa sobre la portada, chica y semitransparente (forest-ink al 80 %) para que la foto siga siendo lo primero. El h1 de
 *   la página vive acá.
 * - `panel`: placa chica sobre el panel de solicitud (nombre, barrio y sello mini).
 * - `bar`: «numeración» de la barra inferior móvil (filete + precio «desde» + ARS).
 *
 * Jerarquía de la placa hero: dirección y barrio (una línea que puede partirse), nombre, después el precio con su ARS, y al final el sello (un carril aparte, sin texto: el
 * sello alcanza). Contraste del texto: paper sobre forest-ink al 80 % da 6,7:1 en el PEOR caso (foto casi blanca detrás); el texto
 * secundario (paper al 88 %) da 5,6:1. Sin `backdrop-blur`: con ese contraste no hace falta y se ve la foto de verdad.
 *
 * El sello NO PUEDE TAPAR el precio ni el nombre, en ningún ancho (320 a 1440 px). Se garantiza por ESTRUCTURA, no por
 * posicionamiento: la placa es una fila de dos columnas (`data-plate-region`): «main» (barrio, nombre y precio, apilados en flujo
 * normal) y «seal» (el sello, en SU PROPIO carril, con un ancho que escala con `clamp()` sobre el ancho de la placa). Precio y sello
 * nunca comparten columna ni hay ningún elemento `absolute` adentro. `ResidencePlate.test.ts` verifica esa estructura.
 */
export type ResidencePlateProps =
  | { variant: "hero"; name: string; zone: string | null; address?: string | null; fromPriceUsd: number | null; arsPerUsd: number }
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
  return <HeroPlate name={props.name} zone={props.zone} address={props.address ?? null} fromPriceUsd={props.fromPriceUsd} arsPerUsd={props.arsPerUsd} />;
}

/** «Av. de Mayo 861, Montserrat, CABA»: la dirección pública entra en la placa (antes iba suelta bajo el hero). */
export function plateLocationLine(address: string | null | undefined, zone: string | null | undefined): string | null {
  const parts = [address?.trim() || null, zone?.trim() || null].filter(Boolean) as string[];
  return parts.length > 0 ? `${parts.join(", ")}, CABA` : null;
}

function HeroPlate({
  name,
  zone,
  address,
  fromPriceUsd,
  arsPerUsd,
}: {
  name: string;
  zone: string | null;
  address: string | null;
  fromPriceUsd: number | null;
  arsPerUsd: number;
}) {
  const price = fromPriceUsd != null ? fromPriceLabels(fromPriceUsd, arsPerUsd) : null;
  const location = plateLocationLine(address, zone);
  return (
    // El contenedor `@container` mide el ancho real de la placa: de ahí salen el tamaño del nombre y el del sello (`cqw`).
    <div data-plate="hero" className="@container w-full min-w-0 max-w-[500px]">
      <div
        className={`flex items-center gap-3 rounded-field bg-[color:var(--forest-ink-80)] px-[18px] py-3.5 text-paper min-[768px]:gap-4 min-[768px]:px-6 min-[768px]:py-[18px] ${PLATE_FRAME}`}
      >
        {/* Columna principal: barrio, nombre y precio apilados. */}
        <div data-plate-region="main" className="min-w-0 flex-1">
          {location && <p className={`text-[13px] font-semibold leading-snug sm:text-sm ${SOFT}`}>{location}</p>}
          {/* El tamaño se calcula para que la palabra más larga entre en una línea; la clase es solo el respaldo sin `cqw`. */}
          <h1
            className="mt-0.5 text-2xl font-bold leading-[0.95] text-paper [overflow-wrap:anywhere] sm:text-4xl"
            style={{ fontSize: plateTitleFontSize(name), letterSpacing: "-0.03em" }}
          >
            {name}
          </h1>
          {price && (
            <div
              data-plate-region="price"
              className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t-[1.5px] border-[color:var(--paper-16)] pt-2.5"
            >
              <span className="whitespace-nowrap rounded-field bg-paper px-2.5 py-0.5 text-[15px] font-bold tabular-nums text-forest-ink">
                {price.usdPerMonth}
              </span>
              <span className={`flex items-center whitespace-nowrap text-[13px] font-semibold tabular-nums ${SOFT}`}>
                {price.ars}
                <ExchangeRateNote compact onDark />
              </span>
            </div>
          )}
        </div>

        {/* Carril del sello: su propia columna, sin texto al lado (el sello ya dice «Verificada»); el nombre accesible va acá. */}
        <span
          data-plate-region="seal"
          role="img"
          aria-label="Verificada por EstuRed: la visitamos en persona"
          className="aspect-square shrink-0 [--seal-delay:0.6s]"
          style={{ width: PLATE_SEAL_WIDTH }}
        >
          <EsturedSeal tone="cream" stamp size={80} className="size-full" />
        </span>
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
