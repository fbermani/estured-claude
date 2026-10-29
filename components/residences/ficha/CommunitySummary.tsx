import Link from "next/link";
import type { CommunitySummary as CommunityData } from "@/lib/residents/communityVisibility";
import { computeCommunityStats } from "@/lib/residents/communityStats";
import { Icon } from "@/components/ui/Icon";
import {
  CommunityProfilesPreview,
  type PreviewProfile,
  type PreviewSlot,
} from "@/components/residences/ficha/CommunityProfilesPreview";

const SM_COLS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

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
  const visible = cards.filter((c) => c.kind === "profile");

  const profiles: PreviewProfile[] = isGuest
    ? []
    : visible.flatMap((c) =>
        c.firstName
          ? [
              {
                id: c.residentStayId,
                roomTypeName: c.roomTypeName,
                firstName: c.firstName,
                age: c.age ?? null,
                flag: c.countryFlag ?? null,
                nationality: c.nationality ?? null,
                career: c.career ?? null,
                originCity: c.originCity ?? null,
              },
            ]
          : [],
      );
  const slots: PreviewSlot[] = isGuest ? visible.map((c) => ({ id: c.residentStayId, roomTypeName: c.roomTypeName })) : [];
  const shownCount = isGuest ? slots.length : profiles.length;

  // Para el visitante `cards` no trae edad, país ni carrera, así que las cifras dan null.
  const stats = computeCommunityStats(cards);
  const tiles = [
    { value: String(total), label: total === 1 ? "residente hoy" : "residentes hoy" },
    stats?.countries != null && { value: String(stats.countries), label: stats.countries === 1 ? "país de origen" : "países de origen" },
    stats?.ageRange && {
      value: stats.ageRange.min === stats.ageRange.max ? String(stats.ageRange.min) : `${stats.ageRange.min}–${stats.ageRange.max}`,
      label: "años",
    },
    stats?.careers != null && { value: String(stats.careers), label: stats.careers === 1 ? "carrera" : "carreras" },
  ].filter((t): t is { value: string; label: string } => Boolean(t));

  return (
    <div className="space-y-4">
      {statement && (
        <blockquote className="rounded-card border-l-[3px] border-forest bg-forest-tint/45 px-5 py-4">
          <p className="text-sm italic leading-relaxed text-ink-soft">&ldquo;{statement}&rdquo;</p>
          <footer className="mt-2 text-xs font-bold text-forest-700">— La residencia</footer>
        </blockquote>
      )}

      {total > 0 && (
        <>
          {stats && tiles.length > 1 && (
            <dl
              className={`grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card ${SM_COLS[tiles.length] ?? "sm:grid-cols-4"}`}
              aria-label="Cifras de la comunidad"
            >
              {tiles.map((t, i) => (
                <div
                  key={t.label}
                  className={`grid bg-paper px-[18px] py-4 ${tiles.length % 2 === 1 && i === tiles.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
                >
                  <dt className="order-2 text-[12.5px] text-ink-faint">{t.label}</dt>
                  <dd className="order-1 font-display text-[28px] font-extrabold text-forest-700">{t.value}</dd>
                </div>
              ))}
            </dl>
          )}

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
