import Link from "next/link";
import type { Residence } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { CardPhotoCarousel } from "@/components/residences/CardPhotoCarousel";
import { CardAmenityLine } from "@/components/residences/CardAmenityLine";
import { CommunityPlazasButton } from "@/components/residences/CommunityPlazasButton";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { getCommonAreaIcon, getServiceIcon } from "@/lib/residences/amenityIcons";
import { dedupeAmenities } from "@/lib/residences/amenityKeys";
import { findUniversitiesByName, haversineDistanceKm } from "@/lib/data/buenosAiresUniversities";
import { kmToBlocks } from "@/lib/residences/distance";
import { serviceLabel } from "@/lib/residences/options";
import { GENDER_LABELS } from "@/lib/residences/searchFilters";
import { abbreviateUniversity } from "@/lib/residences/universityLabel";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";

/**
 * Tarjeta de resultados de /search (auditoría 2026-11-03, A2): pensada para comparar sin abrir la ficha.
 * Orden: foto (136 px) con sello «Residencia Verificada» y promo → nombre → barrio · quiénes viven → «desde» + precio
 * (tachado si hay promo) + «≈ ARS» con (i) → universidades con cuadras → tipos de habitación en una línea → servicios y
 * áreas comunes (una línea cada uno, hasta 5 íconos + «+N», lista completa al hover/foco o en hoja inferior al tocar) →
 * pie crema con el estado (solo vía `StatusTag`), «N plazas ›» (modal de comunidad, datos lazy) y «Ver residencia».
 * Toda la tarjeta es clickeable por el `::after` del título; los botones del pie, las líneas de amenities y la nota de
 * cambio van por encima (`z-[2]`), así que no hay interactivos dentro de un `<a>`. Dos disposiciones: `grid` (vertical) y
 * `list` (foto a la izquierda cuando la propia tarjeta (contenedor `card`) mide 480 px o más; si no, se apila igual que la grilla).
 * Solo en `list` y con la tarjeta ancha (≥ 560 px) se suman la edad de residentes y, bajo el precio, el precio de lista por
 * tipo de habitación (sin estados de disponibilidad: eso vive solo en `StatusTag`); la grilla queda igual.
 */
export function SearchResultCard({
  residence,
  arsPerUsd,
  layout,
}: {
  residence: Residence;
  arsPerUsd: number;
  layout: "grid" | "list";
}) {
  const list = layout === "list";
  const href = `/residencias/${residence.slug}`;

  const toItems = (names: string[], icon: (n: string) => { icon: string }) =>
    dedupeAmenities(names).map((name) => ({ name: serviceLabel(name), icon: icon(name).icon }));
  const serviceItems = toItems(residence.services, getServiceIcon);
  const areaItems = toItems(residence.commonAreas ?? [], getCommonAreaIcon);

  const hasAvailable = residence.roomTypes.some((rt) => rt.available);

  // Solo las 2 universidades más cercanas (`cardUniversities` ya viene ordenada por cercanía); la ficha lista todas.
  const names = (residence.cardUniversities ?? residence.nearUniversities).slice(0, 2);
  const here = typeof residence.latitude === "number" && typeof residence.longitude === "number" ? { lat: residence.latitude, lng: residence.longitude } : null;
  const coords = new Map(findUniversitiesByName(names).map((u) => [u.name, u]));
  const universities = names.map((name) => {
    const u = coords.get(name);
    return { name, blocks: here && u ? kmToBlocks(haversineDistanceKm(here, u)) : null };
  });

  // Tipos de habitación en una línea: «Individual, doble, triple y cuádruple».
  const typeOrder = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];
  const types = [...new Set(residence.roomTypes.map((rt) => rt.type))].sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));
  const typesLine =
    types.length > 1
      ? `${types.slice(0, -1).map((t, i) => (i === 0 ? t : t.toLowerCase())).join(", ")} y ${types[types.length - 1].toLowerCase()}`
      : (types[0] ?? "");

  // Precio de lista por tipo (solo vista lista): el más bajo de cada tipo, entre los que tienen lugar; si ninguno tiene, todos.
  // Igual que el «desde», que excluye los tipos completos. No dice nada de disponibilidad.
  const offered = residence.roomTypes.some((rt) => rt.available) ? residence.roomTypes.filter((rt) => rt.available) : residence.roomTypes;
  const typePrices = [...offered.reduce((m, rt) => m.set(rt.type, Math.min(m.get(rt.type) ?? Infinity, rt.priceUsd)), new Map<string, number>())]
    .filter(([, usd]) => Number.isFinite(usd) && usd > 0)
    .sort((a, b) => typeOrder.indexOf(a[0]) - typeOrder.indexOf(b[0]));
  const showTypePrices = list && typePrices.length > 1;

  // Edad de residentes (solo vista lista): «De 18 a 30 años» / «Desde 18 años».
  const ageLine =
    residence.minResidentAge != null
      ? residence.maxResidentAge != null
        ? `De ${residence.minResidentAge} a ${residence.maxResidentAge} años`
        : `Desde ${residence.minResidentAge} años`
      : null;

  // Plazas totales de la residencia (sin separar hombres y mujeres) + sello de quiénes pueden vivir.
  const places = residence.capacityPlaces != null && residence.capacityPlaces > 0 ? Math.floor(residence.capacityPlaces) : null;
  const policies = residence.genderPolicies ?? (residence.genderPolicy ? [residence.genderPolicy] : []);
  // Un solo texto: si hay habitaciones de hombres y de mujeres (sin tipos mixtos) no se listan dos.
  const genderLabel =
    policies.length === 0
      ? null
      : policies.length > 1
        ? policies.includes("mixto")
          ? "Mixta"
          : "Hombres y mujeres"
        : policies[0] === "mixto"
          ? "Mixta"
          : GENDER_LABELS[policies[0]];

  const genderTone =
    policies.length === 1 && policies[0] === "solo_mujeres"
      ? "bg-lilac text-lilac-fg"
      : policies.length === 1 && policies[0] === "solo_hombres"
        ? "bg-sky text-sky-fg"
        : "bg-mint text-forest-700";

  return (
    <article
      aria-label={residence.name}
      className={`group group/card relative grid rounded-card border-[1.5px] border-line-2 bg-paper shadow-anchor motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out-fresh [@media(hover:hover)]:motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1 hover:shadow-card-hover focus-within:shadow-card-hover ${
        list ? "grid-cols-[minmax(0,1fr)] @min-[480px]/card:grid-cols-[11.5rem_minmax(0,1fr)] @min-[640px]/card:grid-cols-[15.5rem_minmax(0,1fr)] @min-[480px]/card:grid-rows-[1fr_auto]" : "grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto]"
      }`}
    >
      <CardPhotoCarousel
        photos={residence.photos}
        name={residence.name}
        zone={residence.zone}
        href={href}
        sizes={list ? "(max-width: 640px) 100vw, 248px" : "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"}
        className={`z-[2] h-[136px] rounded-t-[calc(var(--radius-card)-2px)] ${list ? "@min-[480px]/card:row-span-2 @min-[480px]/card:h-auto @min-[480px]/card:min-h-52 @min-[480px]/card:rounded-bl-[calc(var(--radius-card)-2px)] @min-[480px]/card:rounded-tr-none" : ""}`}
      >
        <div className="absolute left-2.5 top-2.5">
          <TrustBadge status={residence.verificationStatus} />
        </div>
        {residence.promotionPercent != null && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-amber-soft-100 px-2.5 py-1 text-xs font-bold text-amber-soft-700 shadow-float">
            <Icon name="sell" className="text-[15px]" />
            −{residence.promotionPercent}%
          </span>
        )}
      </CardPhotoCarousel>

      <div className={`grid min-w-0 content-start gap-x-4 gap-y-2 px-3.5 pb-2.5 pt-3 ${list ? "@min-[560px]/card:grid-cols-[minmax(0,1fr)_auto]" : ""}`}>
        <div>
          <h3 className="text-[17px] leading-tight">
            <Link href={href} className="after:absolute after:inset-0 after:z-[1] after:rounded-card hover:underline focus-visible:outline-2 focus-visible:outline-forest">
              {residence.name}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 text-[15px] font-semibold text-forest-700">
              <Icon name="location_on" className="text-[17px]" />
              {residence.zone}
            </span>
            {genderLabel && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${genderTone}`}>{genderLabel}</span>
            )}
          </p>
        </div>

        <div className={list ? "@min-[560px]/card:col-start-2 @min-[560px]/card:row-start-1 @min-[560px]/card:row-span-3 @min-[560px]/card:text-right" : ""}>
          <p className={`flex flex-wrap items-baseline gap-x-1 ${list ? "@min-[560px]/card:justify-end" : ""}`}>
            <span className="text-[13px] text-ink-faint">desde</span>
            {residence.priceFromListUsd != null && (
              <span className="text-sm font-semibold text-ink-faint line-through">
                <span className="sr-only">Antes </span>
                {formatUsd(residence.priceFromListUsd)}
              </span>
            )}
            <span className="whitespace-nowrap">
              <b className="font-display text-[22px] font-bold tracking-tight text-ink tabular-nums">{formatUsd(residence.priceFromUsd)}</b>
              <span className="ml-1 text-[13px] text-ink-faint">/mes</span>
            </span>
          </p>
          <p className={`relative z-[2] flex items-center gap-0.5 text-[12.5px] tabular-nums text-ink-faint ${list ? "@min-[560px]/card:justify-end" : ""}`}>
            ≈ {formatArs(usdToArsRounded(residence.priceFromUsd, arsPerUsd))}
            <ExchangeRateNote compact />
          </p>
          {showTypePrices && (
            <dl className="mt-3 hidden min-w-44 gap-y-1 border-t border-line pt-2 text-[13px] tabular-nums @min-[560px]/card:grid @min-[560px]/card:grid-cols-[auto_auto] @min-[560px]/card:justify-end @min-[560px]/card:gap-x-3">
              {typePrices.map(([type, usd]) => (
                <div key={type} className="contents">
                  <dt className="text-left text-ink-soft">{type}</dt>
                  <dd className="font-semibold text-ink">{formatUsd(usd)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <ul className={`grid gap-1 text-[13px] leading-snug text-ink-soft ${list ? "@min-[560px]/card:col-start-1" : ""}`}>
          {universities.length > 0 && (
            <li className="flex items-start gap-2">
              <Icon name="school" className="mt-px text-[18px] text-forest-700" />
              <span className="min-w-0">
                <span className="sr-only">Universidades cercanas: </span>
                {universities.map((u) => (
                  <span key={u.name} className="block">
                    {abbreviateUniversity(u.name)}
                    {u.blocks !== null && `, ${u.blocks} ${u.blocks === 1 ? "cuadra" : "cuadras"}`}
                  </span>
                ))}
              </span>
            </li>
          )}
          {list && ageLine && (
            <li className="hidden items-start gap-2 @min-[560px]/card:flex">
              <Icon name="cake" className="mt-px text-[18px] text-forest-700" />
              <span className="min-w-0">
                <span className="sr-only">Edad de residentes: </span>
                {ageLine}
              </span>
            </li>
          )}
          {typesLine && (
            <li className="flex items-start gap-2">
              <Icon name="bed" className="mt-px text-[18px] text-forest-700" />
              <span className="min-w-0">
                <span className="sr-only">Tipos de habitación: </span>
                {typesLine}
              </span>
            </li>
          )}
        </ul>

        {(serviceItems.length > 0 || areaItems.length > 0) && (
          <div className={`grid gap-0 ${list ? "@min-[560px]/card:col-start-1" : ""}`}>
            <CardAmenityLine label="Servicios" residenceName={residence.name} items={serviceItems} />
            <CardAmenityLine label="Áreas comunes" residenceName={residence.name} items={areaItems} />
          </div>
        )}
      </div>

      <div className="relative z-[2] flex flex-wrap items-center gap-x-2 gap-y-2 rounded-b-[calc(var(--radius-card)-2px)] border-t border-line bg-cream px-3.5 py-2.5">
        <div className={`flex basis-full flex-wrap items-center gap-1.5 ${list ? "@min-[560px]/card:basis-auto @min-[560px]/card:mr-auto" : ""}`}>
          <StatusTag mode={residence.availabilityMode} />
          {!hasAvailable && residence.availabilityHint === "waitlist" && <Badge tone="neutral">Lista de espera abierta</Badge>}
        </div>
        {places && <CommunityPlazasButton slug={residence.slug} name={residence.name} places={places} genderLabel={genderLabel} />}
        <Link
          href={href}
          className={`flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-0.5 whitespace-nowrap rounded-full bg-forest px-4 ${list ? "@min-[560px]/card:flex-none @min-[560px]/card:px-6" : ""}
          text-sm font-bold text-white transition-[background-color,transform] duration-150 ease-out-fresh motion-safe:active:scale-[0.97] hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}
        >
          Ver residencia
          <Icon name="chevron_right" className="text-lg" />
        </Link>
      </div>
    </article>
  );
}
