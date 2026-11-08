import Link from "next/link";
import type { CommunitySummary as CommunityData } from "@/lib/residents/communityVisibility";
import { computeCommunityStats } from "@/lib/residents/communityStats";
import { CommunityStatsGrid } from "@/components/residences/ficha/CommunityStatsGrid";
import { Icon } from "@/components/ui/Icon";
import { toPreviewData } from "@/lib/residents/communityPreview";
import { CommunityProfilesPreview } from "@/components/residences/ficha/CommunityProfilesPreview";

/**
 * Comunidad de la ficha (propuesta C + cifras de A): frase de la residencia, cifras agregadas (solo con 3 o más
 * perfiles visibles), vista previa de perfiles con filtro por tipo de habitación y aviso de privacidad. La
 * disponibilidad por tipo vive solo en Tarifas (misma fuente), por eso acá no aparece. El mapa de camas completo
 * vive en `/residencias/[slug]/comunidad`.
 *
 * Privacidad: se arma en el servidor con lo que `getCommunityVisibility` ya devuelve para este viewer. Al cliente
 * llega solo lo mínimo de cada tarjeta; el visitante no recibe ningún dato individual (solo cuántos lugares hay).
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
  const total = community?.totalResidents ?? 0;
  const cards = community?.cards ?? [];

  const { profiles, slots } = toPreviewData(cards, isGuest);
  const shownCount = isGuest ? slots.length : profiles.length;

  // Para el visitante `cards` no trae edad, país ni carrera, así que las cifras dan null.
  const stats = computeCommunityStats(cards);

  return (
    <div className="space-y-4">
      {statement && (
        <blockquote className="rounded-card border-l-4 border-forest bg-forest-tint/45 px-5 py-4">
          <p className="text-sm italic leading-relaxed text-ink-soft">&ldquo;{statement}&rdquo;</p>
          <footer className="mt-2 text-xs font-bold text-forest-700">— La residencia</footer>
        </blockquote>
      )}

      {total > 0 && (
        <>
          <CommunityStatsGrid total={total} stats={stats} />

          {shownCount > 0 ? (
            <CommunityProfilesPreview
              slug={slug}
              isGuest={isGuest}
              profiles={profiles}
              slots={slots}
              totalProfiles={shownCount}
            />
          ) : (
            <p className="rounded-card border border-line bg-paper px-5 py-4 text-sm text-ink-soft shadow-card">
              Hoy viven {total} {total === 1 ? "residente" : "residentes"} y todavía nadie eligió mostrar su perfil.
            </p>
          )}

          <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ink-faint">
            <Icon name="info" className="text-base" />
            <span>
              Se muestran solo los perfiles que cada estudiante eligió compartir. Pueden cambiar antes de tu ingreso. La
              disponibilidad por habitación está en{" "}
              <Link href="#tarifas" className="font-semibold text-forest-700 hover:underline">
                Tarifas
              </Link>
              .
            </span>
          </p>
        </>
      )}
    </div>
  );
}
