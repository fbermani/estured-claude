"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Residence, RoomTypeName } from "@/types/domain";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { availabilityHelpText } from "@/components/ui/StatusTag";
import { COMMON_AREA_OPTIONS, SERVICE_OPTIONS, serviceLabel } from "@/lib/residences/options";
import { UNIVERSITY_NAMES } from "@/lib/data/buenosAiresUniversities";

/**
 * Catálogo con filtros — layout a semejanza de la referencia
 * `estured_search_results_buenos_aires`: buscador por universidad,
 * fila de "Filtros rápidos" como pills con panel desplegable
 * (checkboxes para barrio y tipo de habitación) y grilla de cards.
 * Sin mapa ni favoritos (no existen esas features) ni filtro por
 * fechas (la disponibilidad real no tiene granularidad de fechas).
 */

const ROOM_TYPE_OPTIONS: RoomTypeName[] = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];

const PRICE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Sin límite" },
  { value: "250", label: "Hasta USD 250" },
  { value: "300", label: "Hasta USD 300" },
  { value: "400", label: "Hasta USD 400" },
  { value: "500", label: "Hasta USD 500" },
];

function FilterPill({
  label,
  activeCount,
  open,
  onToggle,
  children,
}: {
  label: string;
  activeCount: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors ${
          activeCount > 0 || open
            ? "border-forest bg-forest-tint text-forest-700"
            : "border-line bg-paper text-ink-soft hover:border-line-2"
        }`}
      >
        {label}
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">
            {activeCount}
          </span>
        )}
        <Icon name={open ? "expand_less" : "expand_more"} className="text-lg" />
      </button>
      {open && (
        <div className="animate-dropdown-in absolute left-0 top-full z-20 mt-2 min-w-56 rounded-card border-[1.5px] border-line bg-paper p-3 shadow-float">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-field px-2 py-1.5 text-sm text-ink hover:bg-cream-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-line-2 accent-[var(--color-forest)]"
      />
      {label}
    </label>
  );
}

function RadioOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-field px-2 py-1.5 text-sm text-ink hover:bg-cream-2">
      <input type="radio" checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--color-forest)]" />
      {label}
    </label>
  );
}

export function SearchCatalog({
  residences,
  arsPerUsd,
  barrios,
  extraServices = [],
  extraAreas = [],
  selectedServices,
  selectedAreas,
}: {
  residences: Residence[];
  arsPerUsd: number;
  barrios: string[];
  /** Ítems «Otro» aprobados presentes en el catálogo (DR18 t4). */
  extraServices?: string[];
  extraAreas?: string[];
  selectedServices: string[];
  selectedAreas: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Servicios y áreas comunes viajan como query params (`servicios`, `areas`): la página filtra en el servidor.
  const toggleAmenityParam = (key: "servicios" | "areas", current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) params.set(key, next.join(","));
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  };
  const [university, setUniversity] = useState("");
  const [zoneSet, setZoneSet] = useState<Set<string>>(new Set());
  const [roomTypeSet, setRoomTypeSet] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState("");
  const [openPill, setOpenPill] = useState<string | null>(null);
  // En mobile los filtros ocupaban casi toda la primera pantalla: arrancan
  // plegados detrás de un botón "Filtros" (H31). En desktop siempre visibles.
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  const all = residences;
  const zones = barrios;

  const toggleInSet = (set: Set<string>, value: string, apply: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  const filtered = useMemo(() => {
    const uni = university.trim().toLowerCase();
    return all.filter((r) => {
      if (uni && !r.nearUniversities.some((u) => u.toLowerCase().includes(uni))) return false;
      if (zoneSet.size > 0 && !zoneSet.has(r.zone)) return false;
      if (roomTypeSet.size > 0 && !r.roomTypes.some((rt) => roomTypeSet.has(rt.type))) return false;
      if (maxPrice && r.priceFromUsd > Number(maxPrice)) return false;
      return true;
    });
  }, [all, university, zoneSet, roomTypeSet, maxPrice]);

  const hasFilters = university.trim() !== "" || zoneSet.size > 0 || roomTypeSet.size > 0 || maxPrice !== "" || selectedServices.length > 0 || selectedAreas.length > 0;
  const activeFilterCount =
    (university.trim() !== "" ? 1 : 0) + zoneSet.size + roomTypeSet.size + (maxPrice !== "" ? 1 : 0) + selectedServices.length + selectedAreas.length;
  const clearFilters = () => {
    setUniversity("");
    setZoneSet(new Set());
    setRoomTypeSet(new Set());
    setMaxPrice("");
    setOpenPill(null);
    if (selectedServices.length > 0 || selectedAreas.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("servicios");
      params.delete("areas");
      const qs = params.toString();
      router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    }
  };
  const togglePill = (name: string) => setOpenPill((current) => (current === name ? null : name));

  // Accesibilidad: los filtros deben poder cerrarse con teclado, no solo clickeando afuera.
  useEffect(() => {
    if (!openPill) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPill(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openPill]);

  return (
    <div>
      {/* Cerrar dropdowns al clickear afuera */}
      {openPill && <div className="fixed inset-0 z-10" onClick={() => setOpenPill(null)} aria-hidden />}

      {/* Mobile: botón "Filtros" que despliega el buscador y los filtros rápidos */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <button
          type="button"
          onClick={() => {
            setOpenPill(null);
            setFiltersOpenMobile((v) => !v);
          }}
          aria-expanded={filtersOpenMobile}
          aria-controls="catalog-filters"
          className={`flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 py-2.5 text-sm font-bold transition-colors ${
            activeFilterCount > 0 || filtersOpenMobile
              ? "border-forest bg-forest-tint text-forest-700"
              : "border-line bg-paper text-ink-soft"
          }`}
        >
          <Icon name="tune" className="text-lg" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1 text-[11px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          <Icon name={filtersOpenMobile ? "expand_less" : "expand_more"} className="text-lg" />
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer text-sm font-semibold text-ink-soft underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div id="catalog-filters" className={`${filtersOpenMobile ? "mt-4 block" : "hidden"} md:mt-0 md:block`}>
      {/* Buscador por universidad — ref: campo "Universidad: Ej UBA, UADE, UCA" */}
      <div className="rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card sm:p-5">
        <label htmlFor="filter-university" className="mb-1.5 block text-sm font-bold text-ink">
          Universidad
        </label>
        <div className="relative">
          <Icon name="school" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-ink-faint" />
          <select
            id="filter-university"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            className="w-full appearance-none rounded-field border-[1.5px] border-field-border bg-cream py-2.5 pl-11 pr-9 text-sm text-ink focus:border-forest focus:outline-none"
          >
            <option value="">Cualquier universidad</option>
            {UNIVERSITY_NAMES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <Icon name="expand_more" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xl text-ink-faint" />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Solo aparecen residencias que eligieron esa sede como cercana; les recomendamos elegir sedes a no más de 15 cuadras.
        </p>
      </div>

      {/* Filtros rápidos */}
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-forest-700">
          <Icon name="tune" className="text-lg" />
          Filtros rápidos:
        </span>

        <FilterPill label="Barrio" activeCount={zoneSet.size} open={openPill === "zone"} onToggle={() => togglePill("zone")}>
          {zones.map((z) => (
            <CheckOption key={z} label={z} checked={zoneSet.has(z)} onChange={() => toggleInSet(zoneSet, z, setZoneSet)} />
          ))}
        </FilterPill>

        <FilterPill
          label="Tipo de habitación"
          activeCount={roomTypeSet.size}
          open={openPill === "room"}
          onToggle={() => togglePill("room")}
        >
          {ROOM_TYPE_OPTIONS.map((t) => (
            <CheckOption
              key={t}
              label={t}
              checked={roomTypeSet.has(t)}
              onChange={() => toggleInSet(roomTypeSet, t, setRoomTypeSet)}
            />
          ))}
        </FilterPill>

        <FilterPill
          label="Precio"
          activeCount={maxPrice ? 1 : 0}
          open={openPill === "price"}
          onToggle={() => togglePill("price")}
        >
          {PRICE_OPTIONS.map((o) => (
            <RadioOption
              key={o.value}
              label={o.label}
              checked={maxPrice === o.value}
              onChange={() => {
                setMaxPrice(o.value);
                setOpenPill(null);
              }}
            />
          ))}
        </FilterPill>

        <FilterPill
          label="Servicios"
          activeCount={selectedServices.length}
          open={openPill === "services"}
          onToggle={() => togglePill("services")}
        >
          {[...SERVICE_OPTIONS, ...extraServices].map((o) => (
            <CheckOption
              key={o}
              label={serviceLabel(o)}
              checked={selectedServices.includes(o)}
              onChange={() => toggleAmenityParam("servicios", selectedServices, o)}
            />
          ))}
        </FilterPill>

        <FilterPill
          label="Áreas comunes"
          activeCount={selectedAreas.length}
          open={openPill === "areas"}
          onToggle={() => togglePill("areas")}
        >
          {[...COMMON_AREA_OPTIONS, ...extraAreas].map((o) => (
            <CheckOption
              key={o}
              label={o}
              checked={selectedAreas.includes(o)}
              onChange={() => toggleAmenityParam("areas", selectedAreas, o)}
            />
          ))}
        </FilterPill>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="hidden cursor-pointer text-sm font-semibold text-ink-soft underline-offset-2 hover:underline md:inline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      </div>

      <div className="mb-5 mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-forest-700">
          {filtered.length} {filtered.length === 1 ? "residencia encontrada" : "residencias encontradas"}
        </p>
        <p className="text-xs text-ink-faint">{availabilityHelpText("by_room_type_to_confirm")}</p>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ResidenceCard key={r.slug} residence={r} arsPerUsd={arsPerUsd} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search_off"
          title="No encontramos residencias con esos filtros"
          description="Probá ampliar la búsqueda: quitá algún filtro o aumentá el presupuesto. El catálogo crece semana a semana."
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          }
        />
      )}
    </div>
  );
}
