import Link from "next/link";
import type { Residence } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";

/** Tarjeta reducida para la home (DR22): foto, sello, nombre, barrio, precio «desde» y disponibilidad. */
export function ResidenceCardCompact({ residence, arsPerUsd }: { residence: Residence; arsPerUsd: number }) {
  const href = `/residencias/${residence.slug}`;
  return (
    <Card className="group relative flex h-full flex-col overflow-hidden transition-all duration-200 motion-safe:active:scale-[0.985] active:shadow-card-hover">
      <div>
        <div className="relative aspect-[16/10] overflow-hidden bg-sand-100">
          <ResidencePhoto
            src={residence.photos[0]}
            name={residence.name}
            zone={residence.zone}
            alt=""
            sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 25vw"
            imageClassName="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute left-2.5 top-2.5">
            <TrustBadge status={residence.verificationStatus} />
          </div>
        </div>
        <div className="px-4 pt-3">
          <h3 className="text-base font-bold leading-snug text-ink">
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
              {residence.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-soft">
            <Icon name="location_on" className="text-base text-ink-faint" />
            {residence.zone}
          </p>
        </div>
      </div>
      <div className="pointer-events-none relative mt-auto px-4 pb-4 pt-3 [&_button]:pointer-events-auto">
        <p className="text-base font-bold text-forest-700">
          <span className="text-xs font-normal text-ink-faint">Desde </span>
          {formatUsd(residence.priceFromUsd)}
          <span className="ml-1 text-xs font-normal text-ink-faint">/mes</span>
        </p>
        <p className="text-xs text-ink-faint">
          ≈ {formatArs(usdToArsRounded(residence.priceFromUsd, arsPerUsd))} referencial
          <ExchangeRateNote />
        </p>
        <div className="mt-2">
          <StatusTag mode={residence.availabilityMode} />
        </div>
      </div>
    </Card>
  );
}
