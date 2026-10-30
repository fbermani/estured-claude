import type { Metadata } from "next";
import { SearchShell, type FilterGroup } from "@/app/(public)/search/SearchShell";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { getCatalogResidencesWithTotal } from "@/lib/residences/catalog";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { availabilityHelpText, availabilityLabel } from "@/components/ui/StatusTag";
import { getSessionUser } from "@/lib/auth/session";
import { getStudentAgeAt, parseIngresoParam } from "@/lib/residences/studentAge";
import { todayIso } from "@/lib/residences/age";
import { COMMON_AREA_OPTIONS, SERVICE_OPTIONS, serviceLabel } from "@/lib/residences/options";
import {
  ROOM_TYPE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  applySearchFilters,
  buildCounts,
  buildUniverse,
  countActiveFilters,
  parseSearchFilters,
  priceBounds,
  type SearchParamsInput,
} from "@/lib/residences/searchFilters";

export const metadata: Metadata = {
  title: "Buscar residencias en CABA",
  description:
    "Explorá residencias estudiantiles verificadas en CABA. Filtrá por barrio, universidad, servicios y precio.",
};
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

  const head = (
    <div className="mb-5 max-w-2xl sm:mb-8">
      <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Encontrá tu próximo hogar en Buenos Aires</h1>
      <p className="mt-2 text-ink-soft">
        Todas las residencias del catálogo fueron verificadas presencialmente. La disponibilidad es informativa y toda
        reserva está sujeta a confirmación.
      </p>
    </div>
  );

  if (residences.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
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
    services: [...SERVICE_OPTIONS, ...universe.extraServices],
    areas: [...COMMON_AREA_OPTIONS, ...universe.extraAreas],
    status: statusOptions,
  };
  const { counts, promo, minor } = buildCounts(residences, filters, options);
  // Dentro de cada grupo, primero las opciones con más resultados (los barrios y universidades); servicios/áreas/tipos mantienen el orden de la ficha.
  const opt = (key: keyof typeof options, label: (v: string) => string, sort = false) => {
    const list = options[key].map((value) => ({ value, label: label(value), count: counts[key][value] ?? 0 }));
    return sort ? list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es")) : list;
  };
  const same = (v: string) => v;
  const groups: FilterGroup[] = [
    { key: "barrio", title: "Barrio", options: opt("barrio", same, true), show: 6 },
    { key: "uni", title: "Universidad cercana", options: opt("uni", same, true), show: 5 },
    { key: "room", title: "Tipo de habitación", options: opt("room", same), show: 5 },
    { key: "services", title: "Servicios", hint: "Se muestran las que ofrecen todos los que elijas.", options: opt("services", serviceLabel), show: 6 },
    { key: "areas", title: "Áreas comunes", hint: "Se muestran las que ofrecen todas las que elijas.", options: opt("areas", same), show: 4 },
    {
      key: "status",
      title: "Disponibilidad",
      hint: "Informativa: toda solicitud queda sujeta a confirmación.",
      options: opt("status", (m) => availabilityLabel(m as (typeof STATUS_FILTER_OPTIONS)[number])),
      show: 4,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {head}
      <SearchShell
        groups={groups}
        filters={filters}
        bounds={priceBounds(residences)}
        promoCount={promo}
        minorCount={minor}
        activeCount={countActiveFilters(filters)}
        resultCount={results.length}
      >
        {results.length > 0 ? (
          <>
            <p className="mb-4 text-xs text-ink-faint">{availabilityHelpText("by_room_type_to_confirm")}</p>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r) => (
                <ResidenceCard key={r.slug} residence={r} arsPerUsd={rate.arsPerUsd} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon="search_off"
            title="No encontramos residencias con esos filtros"
            description="Probá ampliar la búsqueda: quitá algún filtro o ajustá el presupuesto. El catálogo crece semana a semana."
          />
        )}
      </SearchShell>
    </div>
  );
}
