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
import { formatOccupancy } from "@/lib/residences/occupancy";
import { GENDER_LABELS } from "@/lib/residences/searchFilters";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";

/**
 * Tarjeta de resultados de /search (propuesta B, 2026-10-29): foto con sello «Residencia Verificada», nombre, barrio,
 * plazas y género, tipos de habitación, universidades cercanas con cuadras, íconos de servicios y áreas comunes,
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
  const maxIcons = list ? 7 : 5;

  const services = dedupeAmenities(residence.services);
  const areas = dedupeAmenities(residence.commonAreas ?? []);
  const serviceItems = services.slice(0, maxIcons).map((name) => ({ name, ...getServiceIcon(name) }));
  const areaItems = areas.slice(0, maxIcons).map((name) => ({ name, ...getCommonAreaIcon(name) }));

  const roomTypes = [...new Set(residence.roomTypes.map((rt) => rt.type))];
  const hasAvailable = residence.roomTypes.some((rt) => rt.available);

  const names = (residence.cardUniversities ?? residence.nearUniversities).slice(0, 3);
  const here = typeof residence.latitude === "number" && typeof residence.longitude === "number" ? { lat: residence.latitude, lng: residence.longitude } : null;
  const coords = new Map(findUniversitiesByName(names).map((u) => [u.name, u]));
  const universities = names.map((name) => {
    const u = coords.get(name);
    return { name, blocks: here && u ? kmToBlocks(haversineDistanceKm(here, u)) : null };
  });

  const residents = (residence.residentsCount ?? 0) > 0 ? residence.residentsCount : null;
  const occupancy =
    formatOccupancy(residence.capacityPlaces, residents) ??
    (residents ? `${residents} ${residents === 1 ? "residente" : "residentes"}` : null);
  const people = [occupancy, (residence.genderPolicies ?? (residence.genderPolicy ? [residence.genderPolicy] : [])).map((g) => GENDER_LABELS[g]).join(" · ") || null].filter(Boolean).join(" · ");

  return (
    <article
      aria-label={residence.name}
      className={`group grid overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card motion-safe:transition-shadow hover:shadow-card-hover ${
        list ? "@min-[620px]/res:grid-cols-[14.5rem_minmax(0,1fr)_14rem]" : "grid-rows-[auto_1fr_auto]"
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
      </CardPhotoCarousel>

      <div className="grid content-start gap-2.5 p-4">
        <h3 className="text-[19px] leading-tight">
          <Link href={href} className="hover:underline focus-visible:outline-2 focus-visible:outline-forest">
            {residence.name}
          </Link>
        </h3>

        <ul className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[13.5px] text-ink-soft">
          <li className="flex items-center gap-1">
            <Icon name="location_on" className="text-[17px] text-ink-faint" />
            {residence.zone}, {residence.city}
          </li>
          {people && (
            <li className="flex items-center gap-1">
              <Icon name="groups" className="text-[17px] text-ink-faint" />
              {people}
            </li>
          )}
          {roomTypes.length > 0 && (
            <li className="flex items-center gap-1">
              <Icon name="bed" className="text-[17px] text-ink-faint" />
              {roomTypes.join(", ")}
            </li>
          )}
        </ul>

        {!hasAvailable && residence.availabilityHint === "waitlist" && <Badge tone="neutral">Lista de espera abierta</Badge>}

        {universities.length > 0 && (
          <ul aria-label="Universidades cercanas" className="flex flex-wrap items-center gap-1.5">
            {universities.map((u) => (
              <li key={u.name} className="inline-flex max-w-full items-center gap-1 rounded-2xl bg-petrol-50 px-2.5 py-[3px] text-[12.5px] leading-tight text-petrol-700">
                <Icon name="school" className="text-sm" />
                <span className="min-w-0">
                  {u.name}
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
            <AmenityIconRow label="Servicios" kind="service" items={serviceItems} extra={Math.max(0, services.length - maxIcons)} moreHref={`${href}#residencia`} moreLabel={`Ver ${services.length - maxIcons} servicios más en la ficha`} />
            <AmenityIconRow label="Áreas comunes" kind="area" items={areaItems} extra={Math.max(0, areas.length - maxIcons)} moreHref={`${href}#residencia`} moreLabel={`Ver ${areas.length - maxIcons} áreas comunes más en la ficha`} />
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
          {residence.promotionPercent != null && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-soft-100 px-2.5 py-1 text-xs font-semibold text-amber-soft-700">
              <Icon name="sell" className="text-[15px]" />
              Promoción vigente · −{residence.promotionPercent}%
            </span>
          )}
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
          className="flex min-h-[42px] w-full items-center justify-center rounded-full bg-forest px-4 text-sm font-bold text-white shadow-card transition-colors hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Ver residencia
        </Link>
      </div>
    </article>
  );
}
