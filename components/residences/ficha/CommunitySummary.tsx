import Link from "next/link";
import { StatusTag } from "@/components/ui/StatusTag";
import { typeAvailabilityMode } from "@/lib/availability/typeAvailability";
import type { CommunitySummary as CommunityData } from "@/lib/residents/communityVisibility";

const AVATAR_TINTS = [
  "bg-forest-tint text-forest-700",
  "bg-orange-tint text-orange-700",
  "bg-mint text-forest-700",
  "bg-sky text-sky-fg",
];

/**
 * Resumen de comunidad de la ficha (D18): una fila por tipo con residentes, pila de avatares de iniciales y la
 * disponibilidad DEL TIPO (misma fuente que Tarifas). Sin camas libres, sin "plazas ocupadas", sin estados internos
 * (como "pendiente de activar cuenta"). El mapa de camas completo vive solo en `/residencias/[slug]/comunidad`.
 */
export function CommunitySummary({
  slug,
  community,
  statement,
  isGuest,
}: {
  slug: string;
  community: CommunityData | null;
  statement: string;
  isGuest: boolean;
}) {
  const types = (community?.byRoomType ?? []).filter((t) => t.roomTypeId);
  const total = community?.totalResidents ?? 0;
  return (
    <div className="space-y-4">
      {statement && (
        <blockquote className="rounded-card border-l-[3px] border-forest bg-forest-tint/45 px-5 py-4">
          <p className="text-sm italic leading-relaxed text-ink-soft">&ldquo;{statement}&rdquo;</p>
          <footer className="mt-2 text-xs font-bold text-forest-700">— La residencia</footer>
        </blockquote>
      )}

      {total > 0 && (
        <div className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <p className="font-display text-2xl font-extrabold text-ink">
              {total} <span className="text-base font-bold text-ink-soft">{total === 1 ? "residente actual" : "residentes actuales"}</span>
            </p>
            <span className="rounded-full bg-cream-2 px-3 py-1 text-xs font-semibold text-ink-soft">
              Cada estudiante decide qué mostrar
            </span>
          </div>
          <ul className="divide-y divide-line">
            {types.map((t) => {
              const initials = (community?.cards ?? [])
                .filter((c) => c.kind === "profile" && c.roomTypeId === t.roomTypeId && c.firstName)
                .slice(0, 4);
              const extra = Math.max(0, t.occupiedCount - initials.length);
              return (
                <li key={t.roomTypeId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-[8rem] flex-1">
                    <p className="font-bold text-ink">{t.roomTypeName}</p>
                    <p className="text-xs text-ink-faint">
                      {t.occupiedCount} {t.occupiedCount === 1 ? "residente" : "residentes"}
                    </p>
                  </div>
                  <div className="flex -space-x-2" aria-hidden="true">
                    {initials.map((c, i) => (
                      <span
                        key={c.residentStayId}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2 ring-paper ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}
                      >
                        {c.firstName?.[0]?.toUpperCase()}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-forest px-1.5 text-[11px] font-bold text-white ring-2 ring-paper">
                        +{extra}
                      </span>
                    )}
                  </div>
                  {t.availabilityState && (
                    <StatusTag
                      mode={typeAvailabilityMode(t.availabilityState)}
                      roomTypeName={t.availabilityState === "full" ? t.roomTypeName : null}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line bg-cream-2/60 px-5 py-3 text-xs leading-relaxed text-ink-faint">
            La convivencia es dinámica: los perfiles son los de hoy y pueden cambiar antes de tu ingreso.
            {isGuest && " Creá tu cuenta para ver nombres, carreras e intereses de quienes eligen mostrarlos."}
          </p>
        </div>
      )}

      {total > 0 && (
        <Link
          href={`/residencias/${slug}/comunidad`}
          className="inline-flex text-sm font-bold text-forest-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Ver comunidad →
        </Link>
      )}
    </div>
  );
}
