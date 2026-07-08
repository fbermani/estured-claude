import Image from "next/image";
import Link from "next/link";
import type { Residence } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusTag } from "@/components/ui/StatusTag";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { formatArs, formatUsd, usdToArs } from "@/lib/mock/exchange";

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

  return (
    <Card interactive className="group overflow-hidden flex flex-col">
      <Link
        href={`/r/${residence.slug}`}
        className="flex flex-col flex-1"
        aria-label={`Ver ${residence.name}`}
      >
        <div className="relative h-48 w-full overflow-hidden bg-sand-200">
          <Image
            src={residence.photos[0]}
            alt={`Foto de ${residence.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute left-3 top-3">
            <TrustBadge status={residence.verificationStatus} />
          </div>
          <div className="absolute bottom-3 left-3">
            <StatusTag mode={residence.availabilityMode} elevated />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <div>
            <h3 className="text-lg font-bold leading-snug text-petrol-800">
              {residence.name}
            </h3>
            <p className="text-sm text-ink-soft">
              {residence.zone}, {residence.city}
            </p>
          </div>

          {residence.nearUniversities.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-petrol-600">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden
              >
                <path d="M10 2L1 7l9 5 7.5-4.17V13h1.5V7L10 2z" />
                <path d="M4.5 10.6V14c0 1.1 2.46 2.5 5.5 2.5s5.5-1.4 5.5-2.5v-3.4L10 13.5l-5.5-2.9z" />
              </svg>
              Cerca de {residence.nearUniversities.join(" y ")}
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

          <p className="text-xs text-ink-faint">
            {keyServices.join(" · ")}
            {moreServices > 0 && ` · +${moreServices} servicios`}
          </p>

          <div className="mt-auto flex items-end justify-between border-t border-sand-200 pt-3">
            <div>
              <p className="text-lg font-bold text-petrol-700">
                {formatUsd(residence.priceFromUsd)}
                <span className="ml-1 text-xs font-normal text-ink-faint">
                  /mes desde
                </span>
              </p>
              <p className="text-xs text-ink-faint">
                ≈ {formatArs(usdToArs(residence.priceFromUsd, arsPerUsd))}{" "}
                referencial
              </p>
            </div>
            <span className="text-sm font-semibold text-petrol-600 transition-transform group-hover:translate-x-0.5">
              Ver más →
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
