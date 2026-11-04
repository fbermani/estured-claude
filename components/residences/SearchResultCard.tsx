import Link from "next/link";
import type { Residence } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { CardPhotoCarousel } from "@/components/residences/CardPhotoCarousel";
import { AmenityIconRow } from "@/components/residences/AmenityIconRow";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { getCommonAreaIcon, getServiceIcon } from "@/lib/residences/amenityIcons";
import { dedupeAmenities } from "@/lib/residences/amenityKeys";
import { findUniversitiesByName, haversineDistanceKm } from "@/lib/data/buenosAiresUniversities";
import { kmToBlocks } from "@/lib/residences/distance";
import { serviceLabel } from "@/lib/residences/options";
import { RoomTypeIcons } from "@/components/residences/RoomTypeIcons";
import { GENDER_LABELS } from "@/lib/residences/searchFilters";
import { abbreviateUniversity } from "@/lib/residences/universityLabel";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";

const GENDER_ICONS = { mixto: "wc", solo_mujeres: "woman", solo_hombres: "man" } as const;

/**
 * Tarjeta de resultados de /search (propuesta B, 2026-10-29): foto con sello «Residencia Verificada», nombre, barrio,
 * plazas totales con sello de género (Mixta / Solo hombres / Solo mujeres), tipos de habitación como íconos de personas,
 * las 2 universidades más cercanas con cuadras, una línea de servicios y otra de áreas comunes (el «+N» lista el resto),
 * disponibilidad (solo vía `StatusTag`), promoción y precio «desde». Dos disposiciones: `grid` (vertical) y `list`
 * (horizontal cuando el contenedor `res` mide 620 px o más; si no, se apila igual que la grilla).
 * El precio y los íconos van fuera del `<Link>` del nombre: la nota de cambio y los tooltips son botones.
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
  const maxIcons = list ? 6 : 4;

  const services = dedupeAmenities(residence.services);
  const areas = dedupeAmenities(residence.commonAreas ?? []);
  const serviceItems = services.slice(0, maxIcons).map((name) => ({ name, ...getServiceIcon(name) }));
  const areaItems = areas.slice(0, maxIcons).map((name) => ({ name, ...getCommonAreaIcon(name) }));

  const hasAvailable = residence.roomTypes.some((rt) => rt.available);

  // Solo las 2 universidades más cercanas (`cardUniversities` ya viene ordenada por cercanía); la ficha lista todas.
  const names = (residence.cardUniversities ?? residence.nearUniversities).slice(0, 2);
  const here = typeof residence.latitude === "number" && typeof residence.longitude === "number" ? { lat: residence.latitude, lng: residence.longitude } : null;
  const coords = new Map(findUniversitiesByName(names).map((u) => [u.name, u]));
  const universities = names.map((name) => {
    const u = coords.get(name);
    return { name, blocks: here && u ? kmToBlocks(haversineDistanceKm(here, u)) : null };
  });

  // Plazas totales de la residencia (sin separar hombres y mujeres) + sello de quiénes pueden vivir.
  const places = residence.capacityPlaces != null && residence.capacityPlaces > 0 ? Math.floor(residence.capacityPlaces) : null;
  const policies = residence.genderPolicies ?? (residence.genderPolicy ? [residence.genderPolicy] : []);
  // Un solo sello: si hay habitaciones de hombres y de mujeres (sin tipos mixtos) no se muestran dos pastillas apiladas.
  const genderSeal =
    policies.length === 0
      ? null
      : policies.length > 1
        ? { icon: "wc", label: policies.includes("mixto") ? "Mixta" : "Hombres y mujeres", title: "Hay habitaciones para hombres y para mujeres" }
        : { icon: GENDER_ICONS[policies[0]], label: policies[0] === "mixto" ? "Mixta" : GENDER_LABELS[policies[0]], title: undefined };

  return (
    <article
      aria-label={residence.name}
      className={`group group/card grid overflow-hidden rounded-card border-[1.5px] border-line-2 bg-paper shadow-anchor motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out-fresh motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1 hover:shadow-card-hover focus-within:shadow-card-hover ${
        list ? "grid-cols-[minmax(0,1fr)] @min-[620px]/res:grid-cols-[14.5rem_minmax(0,1fr)_14rem]" : "grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto]"
      }`}
    >
      <CardPhotoCarousel
        photos={residence.photos}
        name={residence.name}
        zone={residence.zone}
        href={href}
        sizes={list ? "(max-width: 640px) 100vw, 232px" : "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"}
        className={list ? "aspect-[16/10] @min-[620px]/res:aspect-auto @min-[620px]/res:min-h-52" : "aspect-[16/10]"}
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

      <div className="grid min-w-0 content-start gap-2.5 p-4">
        <h3 className="text-[19px] leading-tight">
          <Link href={href} className="hover:underline focus-visible:outline-2 focus-visible:outline-forest">
            {residence.name}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-ink-soft">
          <p className="flex items-center gap-1">
            <Icon name="location_on" className="text-[17px] text-ink-faint" />
            {residence.zone}, {residence.city}
          </p>
        </div>

        {(places || genderSeal) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink-soft">
            {places && (
              <span className="flex items-center gap-1">
                <Icon name="bed" className="text-[17px] text-ink-faint" />
                <b className="font-semibold text-ink">{places}</b> {places === 1 ? "plaza" : "plazas"}
              </span>
            )}
            {genderSeal && (
              <span
                title={genderSeal.title}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sage-50 px-2.5 py-[3px] text-[12.5px] font-semibold text-sage-700"
              >
                <Icon name={genderSeal.icon} className="text-[15px]" />
                {genderSeal.label}
              </span>
            )}
          </div>
        )}

        <RoomTypeIcons roomTypes={residence.roomTypes} />

        {!hasAvailable && residence.availabilityHint === "waitlist" && <Badge tone="neutral">Lista de espera abierta</Badge>}

        {universities.length > 0 && (
          <ul aria-label="Universidades cercanas" className="flex flex-wrap items-center gap-1.5">
            {universities.map((u) => (
              <li key={u.name} className="inline-flex max-w-full items-center gap-1 rounded-2xl bg-petrol-50 px-2.5 py-[3px] text-[12.5px] leading-tight text-petrol-700">
                <Icon name="school" className="text-sm" />
                <span className="min-w-0">
                  {abbreviateUniversity(u.name)}
                  {u.blocks !== null && (
                    <>
                      {" · "}
                      <b>{u.blocks} {u.blocks === 1 ? "cuadra" : "cuadras"}</b>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {(serviceItems.length > 0 || areaItems.length > 0) && (
          <div data-amenity-card className="mt-0.5 grid gap-2.5">
            <AmenityIconRow label="Servicios" kind="service" items={serviceItems} extra={Math.max(0, services.length - maxIcons)} extraNames={services.slice(maxIcons).map(serviceLabel)} moreHref={`${href}#residencia`} moreLabel={`Ver ${services.length - maxIcons} servicios más en la ficha`} />
            <AmenityIconRow label="Áreas comunes" kind="area" items={areaItems} extra={Math.max(0, areas.length - maxIcons)} extraNames={areas.slice(maxIcons).map(serviceLabel)} moreHref={`${href}#residencia`} moreLabel={`Ver ${areas.length - maxIcons} áreas comunes más en la ficha`} />
          </div>
        )}
      </div>

      <div
        className={`flex flex-col gap-2 border-t border-line p-4 ${
          list ? "@min-[620px]/res:items-end @min-[620px]/res:justify-between @min-[620px]/res:border-l @min-[620px]/res:border-t-0 @min-[620px]/res:text-right" : ""
        }`}
      >
        <div className={`flex flex-col gap-2 ${list ? "@min-[620px]/res:items-end" : ""}`}>
          <StatusTag mode={residence.availabilityMode} />
        </div>
        <div>
          <p className={`flex flex-wrap items-baseline gap-x-1 ${list ? "@min-[620px]/res:justify-end" : ""}`}>
            <span className="text-[13px] text-ink-faint">desde</span>
            {residence.priceFromListUsd != null && (
              <span className="text-sm font-semibold text-ink-faint line-through">
                <span className="sr-only">Antes </span>
                {formatUsd(residence.priceFromListUsd)}
              </span>
            )}
            <span className="whitespace-nowrap">
              <b className="font-display text-2xl font-extrabold tracking-tight text-ink">{formatUsd(residence.priceFromUsd)}</b>
              <span className="ml-1 text-[13px] text-ink-faint">/mes</span>
            </span>
          </p>
          <p className="text-[12.5px] text-ink-faint">
            ≈ {formatArs(usdToArsRounded(residence.priceFromUsd, arsPerUsd))}
            <ExchangeRateNote showNote />
          </p>
        </div>
        <Link
          href={href}
          className="flex min-h-[42px] w-full items-center justify-center rounded-full bg-forest px-4 text-sm font-bold text-white shadow-card transition-[background-color,transform] duration-150 ease-out-fresh motion-safe:active:scale-[0.97] hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Ver residencia
        </Link>
      </div>
    </article>
  );
}
