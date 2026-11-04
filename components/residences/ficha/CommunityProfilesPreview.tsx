"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Vista previa de la comunidad en la ficha (propuesta C): tarjetas de perfil con filtro por tipo de habitación.
 * Recibe solo lo mínimo para dibujar cada tarjeta (nombre de pila, edad, país, carrera, ciudad de origen) y solo
 * para quien ya puede verlo. Al visitante anónimo no le llega ningún dato individual: `guest` dibuja tarjetas
 * genéricas difuminadas (barras, no texto) con una invitación explícita a crear la cuenta.
 */
export type PreviewProfile = {
  id: string;
  roomTypeName: string | null;
  firstName: string;
  age: number | null;
  flag: string | null;
  nationality: string | null;
  career: string | null;
  originCity: string | null;
};

export type PreviewSlot = { id: string; roomTypeName: string | null };

const TINTS = [
  "bg-forest-tint text-forest-700",
  "bg-orange-tint text-orange-700",
  "bg-mint text-forest-700",
  "bg-sky text-sky-fg",
  "bg-lilac text-lilac-fg",
  "bg-butter text-butter-fg",
];

/** Cuántas tarjetas se muestran a la vez; el resto vive en la página completa de la comunidad. */
const MAX_VISIBLE = 6;

/** Orden habitual de los tipos de habitación en los filtros; los que no figuran van al final. */
const TYPE_ORDER = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];
const typeRank = (name: string) => {
  const i = TYPE_ORDER.indexOf(name);
  return i === -1 ? TYPE_ORDER.length : i;
};

function ProfileCard({ profile, index }: { profile: PreviewProfile; index: number }) {
  const origin = [profile.flag, profile.originCity ?? profile.nationality].filter(Boolean).join(" ");
  return (
    <li className="flex items-center gap-3 rounded-[18px] border border-line bg-paper p-3 shadow-card transition-transform duration-200 ease-out-fresh hover:-translate-y-0.5">
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[17px] font-bold ${TINTS[index % TINTS.length]}`}
      >
        {profile.firstName[0]?.toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">
          {profile.firstName}
          {profile.age != null && <span className="font-normal text-ink-faint">, {profile.age}</span>}
        </p>
        {origin && <p className="truncate text-[12.5px] text-ink-faint">{origin}</p>}
        {profile.career && <p className="truncate text-[12.5px] font-semibold text-ink-soft">{profile.career}</p>}
      </div>
    </li>
  );
}

function GhostCard({ index }: { index: number }) {
  return (
    <li className="flex items-center gap-3 rounded-[18px] border border-line bg-paper p-3 shadow-card" aria-hidden="true">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${TINTS[index % TINTS.length]}`}>
        <Icon name="person" className="text-2xl" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5 blur-[3px]">
        <span className="block h-3 w-1/2 rounded bg-ink/70" />
        <span className="block h-2.5 w-2/3 rounded bg-ink-faint/60" />
        <span className="block h-2.5 w-3/5 rounded bg-ink-soft/60" />
      </div>
    </li>
  );
}

export function CommunityProfilesPreview({
  slug,
  isGuest,
  profiles,
  slots,
  totalProfiles,
}: {
  slug: string;
  isGuest: boolean;
  /** Registrados: perfiles visibles. Vacío para el visitante. */
  profiles: PreviewProfile[];
  /** Visitante: un lugar por perfil visible (solo tipo de habitación, sin datos de la persona). */
  slots: PreviewSlot[];
  totalProfiles: number;
}) {
  const [filter, setFilter] = useState<string>("all");
  const source: { id: string; roomTypeName: string | null }[] = isGuest ? slots : profiles;
  const typeNames = Array.from(new Set(source.map((s) => s.roomTypeName).filter((n): n is string => !!n))).sort(
    (a, b) => typeRank(a) - typeRank(b),
  );
  const matches = <T extends { roomTypeName: string | null }>(items: T[]) =>
    filter === "all" ? items : items.filter((i) => i.roomTypeName === filter);
  const shownProfiles = matches(profiles).slice(0, MAX_VISIBLE);
  const shownSlots = matches(slots).slice(0, MAX_VISIBLE);

  return (
    <div className="space-y-3">
      {typeNames.length > 1 && (
        <div role="group" aria-label="Filtrar por tipo de habitación" className="flex flex-wrap gap-2">
          {[{ value: "all", label: `Todos · ${source.length}` }, ...typeNames.map((n) => ({ value: n, label: n }))].map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`min-h-11 rounded-full border-[1.5px] px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                filter === f.value
                  ? "border-forest bg-forest text-white"
                  : "border-line-2 bg-paper text-ink-soft hover:bg-cream-2"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isGuest ? (
        <div className="relative">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {shownSlots.map((s, i) => (
              <GhostCard key={s.id} index={i} />
            ))}
          </ul>
          <div className="relative -mt-32 grid justify-items-center gap-1.5 rounded-b-card bg-gradient-to-b from-transparent to-cream/95 to-35% px-4 pb-4 pt-10 text-center">
            <Icon name="lock" className="text-3xl text-forest" />
            <p className="font-display text-lg font-bold text-ink">Creá tu cuenta para ver quiénes son</p>
            <p className="max-w-[340px] text-[12.5px] text-ink-faint">
              Nombres, carreras e intereses de quienes eligen mostrarlos. Es gratis y no te compromete a nada.
            </p>
            <Link
              href="/register/student"
              className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-forest px-6 text-sm font-bold text-white shadow-sm transition duration-200 ease-out-fresh motion-safe:active:scale-[0.97] hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Crear mi cuenta
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-sm font-bold text-forest-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {shownProfiles.map((p, i) => (
              <ProfileCard key={p.id} profile={p} index={i} />
            ))}
          </ul>
          {/* La función más valiosa de la ficha: es un llamado a la acción, no un enlace de texto. */}
          <Link
            href={`/residencias/${slug}/comunidad`}
            className="group/cta flex items-center gap-4 rounded-card bg-forest px-5 py-4 text-white shadow-forest transition duration-200 ease-out-fresh hover:-translate-y-0.5 hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest motion-safe:active:scale-[0.99]"
          >
            <span aria-hidden="true" className="flex -space-x-2.5">
              {profiles.slice(0, 3).map((p, i) => (
                <span
                  key={p.id}
                  className={`flex size-11 items-center justify-center rounded-full border-2 border-forest text-base font-bold ${TINTS[i % TINTS.length]}`}
                >
                  {p.firstName[0]?.toUpperCase()}
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-extrabold leading-tight sm:text-xl">
                Ver los {totalProfiles} {totalProfiles === 1 ? "perfil" : "perfiles"}
              </span>
              <span className="block text-[13px] text-white/85">Conocé con quién vas a vivir antes de reservar</span>
            </span>
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-forest-700 transition-transform duration-200 ease-out-fresh group-hover/cta:translate-x-1"
            >
              <Icon name="arrow_forward" className="text-2xl" />
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
