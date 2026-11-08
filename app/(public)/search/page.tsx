import type { Metadata } from "next";
import { GuidePicks } from "@/components/guides/GuidePicks";
import { SearchShell, type FilterGroup } from "@/app/(public)/search/SearchShell";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { getCatalogResidencesWithTotal } from "@/lib/residences/catalog";
import Link from "next/link";
import { SearchResultCard } from "@/components/residences/SearchResultCard";
import { SearchMap } from "@/components/residences/SearchMap";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { availabilityHelpText, availabilityLabel } from "@/components/ui/StatusTag";
import { getSessionUser } from "@/lib/auth/session";
import { getStudentAgeAt, parseIngresoParam } from "@/lib/residences/studentAge";
import { todayIso } from "@/lib/residences/age";
import { serviceLabel } from "@/lib/residences/options";
import { getCommonAreaIcon, getServiceIcon } from "@/lib/residences/amenityIcons";
import { toMapPoints } from "@/lib/residences/mapPoints";
import {
  GENDER_FILTER_OPTIONS,
  GENDER_LABELS,
  ROOM_TYPE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  areaFilterOptions,
  filtersToQuery,
  priceHistogram,
  removableFilters,
  serviceFilterOptions,
  type GenderPolicy,
  applySearchFilters,
  buildCounts,
  buildUniverse,
  countActiveFilters,
  parseSearchFilters,
  priceBounds,
  type SearchParamsInput,
} from "@/lib/residences/searchFilters";

const SEARCH_DESCRIPTION = "Explorá residencias estudiantiles verificadas en CABA. Filtrá por barrio, universidad, servicios y precio.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParamsInput> }): Promise<Metadata> {
  const params = await searchParams;
  // Cualquier query param (filtros, orden, vista, paginado, ingreso) = variante no indexable; el canonical apunta a /search.
  const hasParams = Object.values(params).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ""));
  return {
    title: "Buscar residencias en CABA",
    description: SEARCH_DESCRIPTION,
    alternates: { canonical: "/search" },
    ...(hasParams ? { robots: { index: false, follow: true } } : {}),
  };
}
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  // DR14: filtro por edad del estudiante autenticado, a la fecha de ingreso del filtro (`?ingreso=AAAA-MM-DD`) o a hoy.
  // Visitante o perfil sin fecha de nacimiento: no se excluye ninguna residencia.
  const params = await searchParams;
  const ingreso = Array.isArray(params.ingreso) ? params.ingreso[0] : params.ingreso;
  const sessionUser = await getSessionUser();
  const studentAge = sessionUser?.roles.includes("student")
    ? await getStudentAgeAt(sessionUser.id, parseIngresoParam(ingreso) ?? todayIso())
    : null;
  const [rate, { residences, total }] = await Promise.all([
    getCurrentExchangeRate(),
    getCatalogResidencesWithTotal({ studentAge }),
  ]);

  // Panel de la derecha del encabezado: datos reales del catálogo (cuántas residencias, en cuántos barrios y desde cuánto).
  const barriosCount = new Set(residences.map((r) => r.zone)).size;
  const minPrice = residences.length > 0 ? Math.min(...residences.map((r) => r.priceFromUsd)) : null;
  const stats = [
    { icon: "apartment", value: String(residences.length), label: residences.length === 1 ? "residencia" : "residencias" },
    { icon: "location_on", value: String(barriosCount), label: barriosCount === 1 ? "barrio" : "barrios" },
    ...(minPrice != null ? [{ icon: "payments", value: `USD ${minPrice}`, label: "precio desde" }] : []),
  ];

  const head = (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)] gap-4 sm:mb-4 md:grid-cols-[minmax(0,1fr)_21rem] md:items-start md:gap-8">
      <div className="max-w-2xl">
        <p className="mb-1.5 text-[13px] text-ink-faint">Inicio › Buscar residencias</p>
        <h1 className="text-[26px] leading-[1.15] font-bold text-ink min-[900px]:text-[34px]">Encontrá tu próximo hogar en Buenos Aires</h1>
        <p className="mt-1.5 max-w-[42.5rem] text-[14.5px] text-ink-soft">
          Todas las residencias del catálogo fueron verificadas presencialmente. La disponibilidad es informativa y toda
          reserva está sujeta a confirmación.
        </p>
        <GuidePicks keys={["01", "02"]} variant="strip" label="Antes de elegir:" className="mt-3" mobileSingle />
      </div>
      {residences.length > 0 && (
        <aside aria-label="Resumen del catálogo" className="hidden rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card md:block">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-700">
            <Icon name="verified" className="text-xl" />
            Catálogo verificado en persona
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {stats.map((st) => (
              <li key={st.label} className="rounded-field bg-cream px-2 py-2.5 text-center">
                <Icon name={st.icon} className="text-xl text-forest-700" />
                <p className="mt-0.5 font-display text-lg font-bold leading-tight text-ink">{st.value}</p>
                <p className="text-xs leading-tight text-ink-faint">{st.label}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-snug text-ink-soft">
            Las visitamos una por una antes de publicarlas. Filtrá por barrio, universidad, servicios y precio.
          </p>
        </aside>
      )}
    </div>
  );

  if (residences.length === 0) {
    return (
      <div className="mx-auto max-w-[80rem] px-4 py-6 sm:px-6 sm:py-8">
        {head}
        {total > 0 ? (
          <EmptyState
            icon="apartment"
            title="No hay residencias para tu edad con estos filtros"
            description="Cada residencia define la edad de sus residentes. Probá con otra fecha de ingreso o consultá más adelante: el catálogo se va ampliando."
          />
        ) : (
          <EmptyState
            icon="apartment"
            title="Todavía no hay residencias verificadas"
            description="Estamos verificando las primeras residencias de la red. Volvé a pasar pronto."
          />
        )}
      </div>
    );
  }

  const universe = buildUniverse(residences);
  const filters = parseSearchFilters(params, universe);
  const results = applySearchFilters(residences, filters);
  const statusOptions = STATUS_FILTER_OPTIONS.filter((m) => residences.some((r) => r.availabilityMode === m));
  const options = {
    barrio: universe.barrios,
    uni: universe.unis,
    room: [...ROOM_TYPE_FILTER_OPTIONS],
    services: serviceFilterOptions(universe.extraServices),
    areas: areaFilterOptions(universe.extraAreas),
    gender: [...GENDER_FILTER_OPTIONS],
    status: statusOptions,
  };
  const { counts, promo, minor } = buildCounts(residences, filters, options);
  // Dentro de cada grupo, primero las opciones con más resultados (los barrios y universidades); servicios/áreas/tipos mantienen el orden de la ficha.
  const opt = (key: keyof typeof options, label: (v: string) => string, sort = false, icon?: (v: string) => string) => {
    const list = options[key].map((value) => ({ value, label: label(value), count: counts[key][value] ?? 0, icon: icon?.(value) }));
    return sort ? list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es")) : list;
  };
  const same = (v: string) => v;
  const groups: FilterGroup[] = [
    { key: "barrio", title: "Barrio", options: opt("barrio", same, true), show: 6 },
    { key: "uni", title: "Universidad cercana", options: opt("uni", same, true), show: 5 },
    { key: "room", title: "Tipo de habitación", options: opt("room", same), show: 5 },
    { key: "services", title: "Servicios", hint: "Se muestran las que ofrecen todos los que elijas.", options: opt("services", serviceLabel, false, (v) => getServiceIcon(v).icon), show: 6 },
    { key: "areas", title: "Áreas comunes", hint: "Se muestran las que ofrecen todas las que elijas.", options: opt("areas", serviceLabel, false, (v) => getCommonAreaIcon(v).icon), show: 4 },
    { key: "gender", title: "Quiénes viven en la residencia", options: opt("gender", (v) => GENDER_LABELS[v as GenderPolicy]), show: 3 },
    {
      key: "status",
      title: "Disponibilidad",
      hint: "Informativa: toda solicitud queda sujeta a confirmación.",
      options: opt("status", (m) => availabilityLabel(m as (typeof STATUS_FILTER_OPTIONS)[number])),
      show: 4,
    },
  ];
  const bounds = priceBounds(residences);
  const histogram = priceHistogram(residences, filters, bounds);
  const labelOf = (group: string, value?: string) => {
    if (group === "promo") return "Con promoción";
    if (group === "minor") return "Admite menores de 18";
    if (group === "price") return "el presupuesto";
    const o = groups.find((g) => g.key === group)?.options.find((x) => x.value === value);
    return o?.label ?? value ?? "";
  };
  // Estado «sin resultados»: las 3 mejores formas de ampliar la búsqueda (qué filtro quitar y cuántas residencias aparecerían).
  const suggestions =
    results.length === 0
      ? removableFilters(filters)
          .map((t) => ({ key: t.key, label: labelOf(t.group, t.value), count: applySearchFilters(residences, t.without).length, qs: filtersToQuery(t.without) }))
          .filter((t) => t.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
      : [];
  const clearQs = filtersToQuery({ ...filters, barrio: [], uni: [], room: [], services: [], areas: [], gender: [], status: [], promo: false, minor: false, pmin: null, pmax: null });
  const hrefFor = (qs: string) => (qs ? `/search?${qs}` : "/search");
  const mapData = filters.view === "mapa" ? toMapPoints(results) : null;

  return (
    <div className="surface-glow-forest relative">
      <div aria-hidden="true" className="grain-layer" />
      <div className="relative mx-auto max-w-[80rem] px-4 py-6 sm:px-6 sm:py-8">
      {head}
      <SearchShell
        groups={groups}
        filters={filters}
        bounds={bounds}
        histogram={histogram}
        promoCount={promo}
        minorCount={minor}
        activeCount={countActiveFilters(filters)}
        resultCount={results.length}
      >
        {results.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No encontramos residencias con estos filtros"
            description="Probá sacando alguno. El catálogo se va ampliando: si todavía no hay una residencia para lo que buscás, volvé a pasar pronto."
            action={
              <div className="mt-1 flex flex-col items-center gap-3">
                {suggestions.length > 0 && (
                  <ul className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((t) => (
                      <li key={t.key}>
                        <Link
                          href={hrefFor(t.qs)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-sage-200 bg-forest-tint py-0 pl-3 pr-2 text-[13px] font-semibold text-forest-700 hover:bg-sage-100 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest"
                        >
                          Quitar «{t.label}», {t.count} {t.count === 1 ? "resultado" : "resultados"}
                          <Icon name="close" className="text-base" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={hrefFor(clearQs)}
                  className="flex min-h-[42px] items-center rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-forest-600 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Borrar todos los filtros
                </Link>
              </div>
            }
          />
        ) : mapData ? (
          <SearchMap points={mapData.points} withoutLocation={mapData.withoutLocation} />
        ) : (
          <>
            <p className="mb-3 text-xs text-ink-faint">{availabilityHelpText("by_room_type_to_confirm")}</p>
            <div className="@container/res">
              <div className={filters.view === "lista" ? "grid gap-4" : "grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4"}>
                {results.map((r) => (
                  <SearchResultCard key={r.slug} residence={r} arsPerUsd={rate.arsPerUsd} layout={filters.view === "lista" ? "list" : "grid"} />
                ))}
              </div>
            </div>
          </>
        )}
      </SearchShell>
      </div>
    </div>
  );
}
