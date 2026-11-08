import { policyOfferLabel } from "@/lib/availability/genderAvailability";
import Link from "next/link";
import type { Residence } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { CardPhotoCarousel } from "@/components/residences/CardPhotoCarousel";
import { AmenityIconRow } from "@/components/residences/AmenityIconRow";
import { getCommonAreaIcon, getServiceIcon } from "@/lib/residences/amenityIcons";
import { formatOccupancy } from "@/lib/residences/occupancy";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { joinUniversityNames } from "@/lib/residences/universityLabel";

/**
 * Card de residencia del catálogo — layout a semejanza de la referencia
 * `estured_search_results_buenos_aires` (foto, nombre + ubicación con
 * pin, contador de residentes, servicios, CTA "Ver residencia" a ancho
 * completo y footer "Ver residentes | Disponibilidad"). Sin toggle de
 * favoritos acá (la feature vive en la ficha + `/students/favorites`,
 * Ciclo 35 — agregarlo a esta card requeriría conocer sesión/estado de
 * favorito en cada render del catálogo, incluido para visitantes
 * anónimos en `/search`) ni badges de clima/señales (feature futura).
 */
export function ResidenceCard({
  residence,
  arsPerUsd,
}: {
  residence: Residence;
  arsPerUsd: number;
}) {
  const availableTypes = residence.roomTypes.filter((rt) => rt.available);
  const cardUniversities = (residence.cardUniversities ?? residence.nearUniversities).slice(0, 3);
  // Íconos en dos filas separadas (servicios / áreas comunes). Los que no entran se resumen en «+N» que lleva a la ficha.
  const MAX_ICONS = 5;
  const serviceItems = residence.services.slice(0, MAX_ICONS).map((name) => ({ name, ...getServiceIcon(name) }));
  const moreServices = Math.max(0, residence.services.length - MAX_ICONS);
  const areaNames = residence.commonAreas ?? [];
  const areaItems = areaNames.slice(0, MAX_ICONS).map((name) => ({ name, ...getCommonAreaIcon(name) }));
  const moreAreas = Math.max(0, areaNames.length - MAX_ICONS);
  const href = `/residencias/${residence.slug}`;
  // DR18: «capacidad · residentes» (sin porcentaje ni «quedan N»). Sin plazas declaradas, queda el conteo de residentes de siempre.
  const residents = (residence.residentsCount ?? 0) > 0 ? residence.residentsCount : null;
  const occupancy =
    formatOccupancy(residence.capacityPlaces, residents) ??
    (residents ? `${residents} ${residents === 1 ? "residente" : "residentes"}` : null);

  return (
    <Card className="group flex flex-col overflow-hidden">
      <CardPhotoCarousel
        photos={residence.photos}
        name={residence.name}
        zone={residence.zone}
        href={href}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      >
        <div className="absolute left-3 top-3">
          <TrustBadge status={residence.verificationStatus} />
        </div>
        <div className="absolute bottom-3 left-3">
          <StatusTag mode={residence.availabilityMode} elevated />
        </div>
      </CardPhotoCarousel>

      <Link href={href} className="flex flex-1 flex-col" aria-label={`Ver ${residence.name}`}>
        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <div>
            <h3 className="text-lg font-bold leading-snug text-ink">{residence.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-soft">
              <Icon name="location_on" className="text-base text-ink-faint" />
              {residence.zone}, {residence.city}
            </p>
          </div>

          {cardUniversities.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-forest-700">
              <Icon name="school" className="text-base" />
              Cerca de {joinUniversityNames(cardUniversities)}
            </p>
          )}

          {occupancy && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-forest-700">
              <Icon name="groups" className="text-lg" />
              {occupancy}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {availableTypes.length > 0 ? (
              availableTypes.map((rt) => (
                <Badge key={`${rt.type}-${rt.gender ?? "todos"}`} tone="petrol">
                  {policyOfferLabel(rt.type, rt.gender)}
                </Badge>
              ))
            ) : residence.availabilityHint === "waitlist" ? (
              <Badge tone="neutral">Lista de espera abierta</Badge>
            ) : residence.availabilityHint === "not_updated" ? (
              <Badge tone="neutral">Sin lugar informado por ahora</Badge>
            ) : null}
          </div>
        </div>
      </Link>

      {/* Íconos de servicios y áreas comunes: botones con tooltip, por eso van fuera del <Link> de la card. */}
      {(serviceItems.length > 0 || areaItems.length > 0) && (
        <div data-amenity-card className="grid gap-3 px-5 pb-4">
          <AmenityIconRow label="Servicios" kind="service" items={serviceItems} extra={moreServices} moreHref={`${href}#residencia`} moreLabel={`Ver ${moreServices} servicios más en la ficha`} />
          <AmenityIconRow label="Áreas comunes" kind="area" items={areaItems} extra={moreAreas} moreHref={`${href}#residencia`} moreLabel={`Ver ${moreAreas} áreas comunes más en la ficha`} />
        </div>
      )}

      {/* El precio queda fuera del <Link> de la card: la nota de tipo de cambio es un botón y no puede ir dentro de un enlace. */}
      <div className="mx-5 border-t-[1.5px] border-line pt-3">
        <p className="text-lg font-bold text-forest-700">
          {residence.priceFromListUsd != null && (
            <span className="mr-1.5 text-sm font-semibold text-ink-faint line-through">
              <span className="sr-only">Antes </span>
              {formatUsd(residence.priceFromListUsd)}
            </span>
          )}
          {formatUsd(residence.priceFromUsd)}
          <span className="ml-1 text-xs font-normal text-ink-faint">/mes desde</span>
        </p>
        <p className="text-xs text-ink-faint">
          ≈ {formatArs(usdToArsRounded(residence.priceFromUsd, arsPerUsd))} referencial
          <ExchangeRateNote />
        </p>
        {residence.promotionPercent != null && <p className="text-xs font-bold text-forest-700">Promoción vigente: −{residence.promotionPercent}%</p>}
      </div>

      <div className="px-5 pb-5 pt-3">
        <Link
          href={href}
          className="block w-full rounded-full bg-forest px-4 py-2.5 text-center text-sm font-bold text-white shadow-card transition-colors hover:bg-forest-600"
        >
          Ver residencia
        </Link>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm font-semibold">
          <Link href={`${href}/comunidad`} className="text-forest-700 hover:underline">
            Ver residentes
          </Link>
          <span className="h-4 w-px bg-line" aria-hidden />
          <Link href={`${href}#disponibilidad`} className="text-forest-700 hover:underline">
            Disponibilidad
          </Link>
        </div>
      </div>
    </Card>
  );
}
