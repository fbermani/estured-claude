import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";

type StatusTone = "neutral" | "amber" | "sage";

/**
 * Card de residencia para el dueño en `/residence/dashboard` — a
 * semejanza de layout/densidad de la referencia Stitch "Operational
 * Command" (foto + badges + grilla de métricas + tarifa + CTA), pero
 * expresada con los tokens FRESH del resto de `/residence/*` (no los
 * tokens `cmd` navy, reservados a `/admin` — mezclar los dos sistemas
 * en la misma área rompería la consistencia que ve el propio dueño al
 * navegar entre esta pantalla y el resto de su panel). Sin franja de
 * KPIs agregados entre residencias (docs/00 §25.3: "no habrá un
 * dashboard agregado") ni métricas inventadas (sin "Destacada" — no
 * existe flag real; sin sugerencias tipo IA sin modelo real detrás).
 */
export function OwnerResidenceCard({
  residenceId,
  role = "owner",
  name,
  zone,
  photoUrl,
  statusLabel,
  statusTone,
  occupancyFull,
  occupied,
  capacity,
  newApplications,
  renewalsPending,
  supportOpen,
  avgPriceUsd,
  availabilityNotice,
  arsPerUsd,
}: {
  residenceId: string;
  /** DR10: el staff ve la tarjeta con "Ver perfil" (solo lectura) y una marca "Staff". */
  role?: "owner" | "staff";
  name: string;
  zone: string;
  photoUrl: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  occupancyFull: boolean;
  occupied: number;
  capacity: number;
  newApplications: number;
  renewalsPending: number;
  supportOpen: number;
  avgPriceUsd: number | null;
  availabilityNotice: string | null;
  arsPerUsd: number;
}) {
  const occupancyPct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  const href = `/residence/${residenceId}`;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative h-36 w-full overflow-hidden bg-sand-200">
        <ResidencePhoto
          src={photoUrl}
          name={name}
          zone={zone}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          label="Sin fotos cargadas"
          labelPosition="bottom"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone={statusTone} className="bg-paper/90 shadow-sm backdrop-blur-sm">
            {statusLabel}
          </Badge>
          {occupancyFull && (
            <Badge tone="petrol" className="bg-paper/90 shadow-sm backdrop-blur-sm">
              Ocupación completa
            </Badge>
          )}
          {role === "staff" && (
            <Badge tone="neutral" className="bg-paper/90 shadow-sm backdrop-blur-sm">
              Staff
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-bold leading-snug text-ink">{name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-soft">
          <Icon name="location_on" className="text-base text-ink-faint" />
          {zone}
        </p>

        {availabilityNotice && (
          <Link
            href={`${href}/availability`}
            className="mt-3 flex items-start gap-2 rounded-field border-[1.5px] border-warning-fg/30 bg-warning-bg px-3 py-2.5 text-xs font-semibold leading-snug text-warning-fg hover:border-warning-fg/60"
          >
            <Icon name="warning" className="mt-px shrink-0 text-base" />
            <span>
              {availabilityNotice} <span className="underline">Actualizar disponibilidad</span>
            </span>
          </Link>
        )}

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Ocupación</p>
            <p className="mt-0.5 font-bold text-ink">
              {occupied}/{capacity}
              {capacity > 0 && <span className="ml-1 font-normal text-ink-soft">({occupancyPct}%)</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Solicitudes</p>
            <p className="mt-0.5 flex items-center gap-1 font-bold text-ink">
              {newApplications} nueva{newApplications === 1 ? "" : "s"}
              {newApplications > 0 && <Icon name="priority_high" className="text-sm text-orange-700" />}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Renovaciones</p>
            <p className="mt-0.5 font-bold text-ink">{renewalsPending} pendiente{renewalsPending === 1 ? "" : "s"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Soporte</p>
            <p className="mt-0.5 font-bold text-ink">{supportOpen} abierto{supportOpen === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t-[1.5px] border-line pt-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Tarifa promedio</p>
            {avgPriceUsd ? (
              <>
                <p className="font-bold text-ink">{formatUsd(avgPriceUsd)}</p>
                <p className="text-xs text-ink-faint">
                  ≈ {formatArs(usdToArsRounded(avgPriceUsd, arsPerUsd))} referencial
                  <ExchangeRateNote />
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">Sin tipos cargados</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button href={href} size="sm">
              Gestionar residencia
            </Button>
            <Link href={`${href}/profile`} className="text-xs font-semibold text-forest-700 hover:underline">
              {role === "owner" ? "Editar perfil" : "Ver perfil"}
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
