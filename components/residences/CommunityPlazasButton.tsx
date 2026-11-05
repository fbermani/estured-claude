"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CommunityStatsGrid } from "@/components/residences/ficha/CommunityStatsGrid";
import { CommunityProfilesPreview } from "@/components/residences/ficha/CommunityProfilesPreview";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { loadCommunityPreview, type CommunityPreview } from "@/app/(public)/search/community-actions";

type State = { status: "idle" } | { status: "loading" } | { status: "done"; data: CommunityPreview };

/**
 * Botón «N plazas ›» del pie de la tarjeta de /search: abre un modal (hoja inferior en móvil) con las cifras de
 * comunidad que YA existen. Se piden recién al abrir (server action), no en el listado. Cada cifra se muestra solo si
 * cumple sus mínimos de privacidad; si ninguna alcanza, «Todavía no hay suficientes perfiles». No hay dato de hombres y
 * mujeres de los residentes: no se muestra ni se estima. Foco, Esc y devolución del foco los resuelve `Dialog`.
 */
export function CommunityPlazasButton({ slug, name, places, genderLabel }: { slug: string; name: string; places: number; genderLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });
  const titleId = useId();
  const shown = state.status === "done" && state.data.ok ? (state.data.guest ? state.data.slots.length : state.data.profiles.length) : 0;

  const load = () => {
    setState({ status: "loading" });
    loadCommunityPreview(slug).then(
      (data) => setState({ status: "done", data }),
      () => setState({ status: "done", data: { ok: false, message: "No pudimos cargar los datos de la comunidad. Probá de nuevo en un rato." } }),
    );
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          if (state.status === "idle" || (state.status === "done" && !state.data.ok)) load();
        }}
        className="relative z-[2] inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-line-2 bg-paper py-1 pl-2 pr-2 text-[12.5px] font-bold text-ink hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Icon name="groups" className="text-[17px] text-forest-700" />
        <span className="tabular-nums">{places}</span> {places === 1 ? "plaza" : "plazas"}
        <Icon name="chevron_right" className="text-base text-ink-faint" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} maxWidthClass="sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div>
            <h2 id={titleId} className="text-xl">Comunidad de {name}</h2>
            <p className="text-[13px] text-ink-faint">
              {places} {places === 1 ? "plaza" : "plazas"}
              {genderLabel ? ` · ${genderLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-cream-2 text-ink-soft focus-visible:outline-2 focus-visible:outline-forest"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 pt-2" aria-live="polite" aria-busy={state.status === "loading"}>
          {state.status === "loading" || state.status === "idle" ? (
            <div className="space-y-3" aria-label="Cargando datos de la comunidad">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[76px] animate-pulse rounded-card bg-cream-2 motion-reduce:animate-none" />
                ))}
              </div>
              <div className="flex gap-2 overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-11 w-24 shrink-0 animate-pulse rounded-full bg-cream-2 motion-reduce:animate-none" />
                ))}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[76px] animate-pulse rounded-[18px] bg-cream-2 motion-reduce:animate-none" />
                ))}
              </div>
            </div>
          ) : !state.data.ok ? (
            <div className="rounded-[12px] bg-cream p-3.5 text-sm text-ink-soft">
              {state.data.message}{" "}
              <button type="button" onClick={load} className="min-h-11 cursor-pointer font-bold text-forest-700 underline underline-offset-2">
                Reintentar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {shown > 0 ? (
                <>
                  <CommunityStatsGrid total={state.data.total} stats={state.data.stats} />
                  <CommunityProfilesPreview
                    slug={slug}
                    isGuest={state.data.guest}
                    profiles={state.data.profiles}
                    slots={state.data.slots}
                    totalProfiles={shown}
                    scrollFilters
                  />
                </>
              ) : (
                <p className="rounded-[12px] bg-cream p-3.5 text-sm text-ink-soft">Todavía no hay suficientes perfiles</p>
              )}
              {state.data.guest ? (
                <Link
                  href={`/login?next=${encodeURIComponent("/search")}`}
                  className="flex min-h-11 items-center rounded-[12px] bg-forest-tint p-3.5 text-sm font-bold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Ingresá para ver más de la comunidad
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
