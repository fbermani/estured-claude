"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { normalizeSearch } from "@/lib/guides/search";
import { AUDIENCE_META, CATEGORY_META } from "@/lib/guides/taxonomy";
import { GUIDE_AUDIENCES, GUIDE_CATEGORIES, type GuideAudience, type GuideCategory } from "@/lib/guides/types";

export interface HubItem {
  id: string;
  category: GuideCategory;
  audience: GuideAudience[];
  featured: boolean;
  /** Texto buscable ya normalizado (título, descripción, categoría, encabezados). */
  search: string;
}

type AudienceFilter = "todas" | GuideAudience;

/**
 * Hub de /guias. Las tarjetas llegan renderizadas desde el servidor (`cards`), así que el HTML inicial
 * contiene todas las guías (indexable); acá solo se decide cuáles mostrar según búsqueda y filtros.
 */
export function GuidesHub({
  items,
  cards,
  featuredCards,
  startHere,
}: {
  items: HubItem[];
  cards: Record<string, ReactNode>;
  featuredCards: Record<string, ReactNode>;
  startHere: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GuideCategory | null>(null);
  const [audience, setAudience] = useState<AudienceFilter>("todas");

  const terms = useMemo(() => normalizeSearch(query).split(/\s+/).filter(Boolean), [query]);
  const filtering = terms.length > 0 || category !== null || audience !== "todas";

  const counts = useMemo(() => {
    const c = {} as Record<GuideCategory, number>;
    for (const k of GUIDE_CATEGORIES) c[k] = items.filter((i) => i.category === k).length;
    return c;
  }, [items]);

  const results = useMemo(
    () =>
      items.filter(
        (i) =>
          (category === null || i.category === category) &&
          (audience === "todas" || i.audience.includes(audience)) &&
          terms.every((t) => i.search.includes(t)),
      ),
    [items, category, audience, terms],
  );

  const featuredItems = items.filter((i) => i.featured);
  const showFeatured = !filtering && featuredItems.length > 0;
  const listed = showFeatured ? results.filter((i) => !i.featured) : results;

  const audienceOptions = [
    { value: "todas" as AudienceFilter, label: "Todas" },
    ...GUIDE_AUDIENCES.filter((a) => items.some((i) => i.audience.includes(a))).map((a) => ({
      value: a as AudienceFilter,
      label: AUDIENCE_META[a].label,
    })),
  ];

  function clear() {
    setQuery("");
    setCategory(null);
    setAudience("todas");
  }

  function pickCategory(c: GuideCategory) {
    setCategory((prev) => (prev === c ? null : c));
    requestAnimationFrame(() => {
      const el = document.getElementById("resultados");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }

  return (
    <>
      <header className="relative overflow-hidden bg-gradient-to-br from-forest-tint via-cream to-cream">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-forest/10" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 size-60 rounded-full bg-orange-tint/70" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.09em] text-forest-700">
            <Icon name="menu_book" className="text-lg!" />
            Centro de Guías
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[2rem] font-extrabold leading-[1.08] text-ink sm:text-5xl">
            Guías para estudiar y vivir en Buenos Aires
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink-soft sm:text-lg">
            Elegir dónde vivir, prepararte para llegar y convivir mejor: recursos prácticos para estudiantes, familias y residencias.
          </p>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-7 max-w-xl">
            <label htmlFor="guias-buscar" className="sr-only">
              Buscar guías
            </label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl! text-ink-faint" />
              <input
                id="guias-buscar"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscá una guía: transporte, convivencia, costos…"
                autoComplete="off"
                className="h-14 w-full rounded-full border-[1.5px] border-field-border bg-paper pl-12 pr-12 text-base text-ink shadow-card placeholder:text-ink-faint focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Borrar búsqueda"
                  className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-forest"
                >
                  <Icon name="close" className="text-xl!" />
                </button>
              )}
            </div>
          </form>
        </div>
      </header>

      <section aria-labelledby="guias-categorias" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <h2 id="guias-categorias" className="sr-only">
          Categorías
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {GUIDE_CATEGORIES.filter((c) => counts[c] > 0).map((c) => {
            const meta = CATEGORY_META[c];
            const active = category === c;
            return (
              <li key={c}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickCategory(c)}
                  className={`flex h-full min-h-11 w-full cursor-pointer flex-col items-start gap-2 rounded-card border-[1.5px] p-4 text-left transition duration-200 ease-out-fresh hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                    active ? "border-forest bg-forest-tint" : "border-line bg-paper shadow-card"
                  }`}
                >
                  <span className={`flex size-10 items-center justify-center rounded-xl ${meta.tile}`}>
                    <Icon name={meta.icon} className="text-2xl!" />
                  </span>
                  <span className="text-sm font-extrabold leading-tight text-ink">{meta.label}</span>
                  <span className="text-xs text-ink-faint">
                    {counts[c]} {counts[c] === 1 ? "guía" : "guías"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {!filtering && startHere}

      {showFeatured && (
        <section aria-labelledby="guias-destacadas" className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
          <SectionHeader align="left" eyebrow="Destacadas" title="Para empezar" />
          <h2 id="guias-destacadas" className="sr-only">
            Guías destacadas
          </h2>
          <ul className="grid gap-5 md:grid-cols-2">
            {featuredItems.map((i) => (
              <li key={i.id}>{featuredCards[i.id]}</li>
            ))}
          </ul>
        </section>
      )}

      <section id="resultados" aria-labelledby="guias-todas" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="guias-todas" className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
              {filtering ? "Resultados" : showFeatured ? "Más guías" : "Todas las guías"}
            </h2>
            <p role="status" aria-live="polite" className="mt-1 text-sm text-ink-soft">
              {filtering
                ? `${results.length} ${results.length === 1 ? "guía encontrada" : "guías encontradas"}`
                : `${items.length} ${items.length === 1 ? "guía" : "guías"} para leer sin crear cuenta`}
            </p>
          </div>
          {filtering && (
            <Button variant="ghost" size="sm" onClick={clear}>
              <Icon name="filter_alt_off" className="text-lg!" />
              Limpiar filtros
            </Button>
          )}
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-bold text-ink-soft">Para quién:</span>
          <FilterChips options={audienceOptions} value={audience} onChange={setAudience} label="Filtrar por audiencia" />
          {category && (
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-forest-tint px-3.5 text-[13.5px] font-semibold text-forest-700 hover:bg-mint focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              {CATEGORY_META[category].label}
              <Icon name="close" className="text-base!" />
              <span className="sr-only">Quitar filtro de categoría</span>
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No encontramos guías con esa búsqueda"
            description="Probá con otra palabra o quitá algún filtro para ver todas las guías."
            action={
              <Button variant="outline" onClick={clear}>
                Ver todas las guías
              </Button>
            }
          />
        ) : (
          listed.length > 0 && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listed.map((i) => (
                <li key={i.id}>{cards[i.id]}</li>
              ))}
            </ul>
          )
        )}
      </section>
    </>
  );
}
