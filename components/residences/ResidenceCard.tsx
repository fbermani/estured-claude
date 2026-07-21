import Image from "next/image";
import Link from "next/link";
import type { Residence } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { formatArs, formatUsd, usdToArs } from "@/lib/mock/exchange";

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
  const keyServices = residence.services.slice(0, 2);
  const moreServices = residence.services.length - keyServices.length;
  const href = `/residencias/${residence.slug}`;

  return (
    <Card className="group flex flex-col overflow-hidden">
      <Link href={href} className="flex flex-1 flex-col" aria-label={`Ver ${residence.name}`}>
        <div className="relative h-48 w-full overflow-hidden bg-sand-200">
          {residence.photos[0] && (
            <Image
              src={residence.photos[0]}
              alt={`Foto de ${residence.name}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
          <div className="absolute left-3 top-3">
            <TrustBadge status={residence.verificationStatus} />
          </div>
          <div className="absolute bottom-3 left-3">
            <StatusTag mode={residence.availabilityMode} elevated />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <div>
            <h3 className="text-lg font-bold leading-snug text-ink">{residence.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-soft">
              <Icon name="location_on" className="text-base text-ink-faint" />
              {residence.zone}, {residence.city}
            </p>
          </div>

          {residence.nearUniversities.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-forest-700">
              <Icon name="school" className="text-base" />
              Cerca de {residence.nearUniversities.join(" y ")}
            </p>
          )}

          {(residence.residentsCount ?? 0) > 0 && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-forest-700">
              <Icon name="groups" className="text-lg" />
              {residence.residentsCount} residentes
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {availableTypes.length > 0 ? (
              availableTypes.map((rt) => (
                <Badge key={rt.type} tone="petrol">
                  {rt.type}
                </Badge>
              ))
            ) : (
              <Badge tone="neutral">Sin lugares informados</Badge>
            )}
          </div>

          {keyServices.length > 0 && (
            <p className="text-xs text-ink-faint">
              {keyServices.join(" · ")}
              {moreServices > 0 && ` · +${moreServices} servicios`}
            </p>
          )}

          <div className="mt-auto border-t-[1.5px] border-line pt-3">
            <p className="text-lg font-bold text-forest-700">
              {formatUsd(residence.priceFromUsd)}
              <span className="ml-1 text-xs font-normal text-ink-faint">/mes desde</span>
            </p>
            <p className="text-xs text-ink-faint">
              ≈ {formatArs(usdToArs(residence.priceFromUsd, arsPerUsd))} referencial
            </p>
          </div>
        </div>
      </Link>

      <div className="px-5 pb-5">
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
