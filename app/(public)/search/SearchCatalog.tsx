"use client";

import { useMemo, useState } from "react";
import type { Residence, RoomTypeName } from "@/types/domain";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/**
 * Catálogo con filtros — layout a semejanza de la referencia
 * `estured_search_results_buenos_aires`: buscador por universidad,
 * fila de "Filtros rápidos" como pills con panel desplegable
 * (checkboxes para barrio y tipo de habitación) y grilla de cards.
 * Sin mapa ni favoritos (no existen esas features) ni filtro por
 * fechas (la disponibilidad real no tiene granularidad de fechas).
 */

const ROOM_TYPE_OPTIONS: RoomTypeName[] = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];

const AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Cualquiera" },
  { value: "by_room_type_to_confirm", label: "Con lugar informado" },
  { value: "full", label: "Completa (lista de espera)" },
];

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
        <div className="absolute left-0 top-full z-20 mt-2 min-w-56 rounded-card border-[1.5px] border-line bg-paper p-3 shadow-float">
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

export function SearchCatalog({ residences, arsPerUsd }: { residences: Residence[]; arsPerUsd: number }) {
  const [university, setUniversity] = useState("");
  const [zoneSet, setZoneSet] = useState<Set<string>>(new Set());
  const [roomTypeSet, setRoomTypeSet] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [openPill, setOpenPill] = useState<string | null>(null);

  const all = residences;
  const zones = useMemo(() => [...new Set(all.map((r) => r.zone))].sort(), [all]);

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
      if (availability && r.availabilityMode !== availability) return false;
      if (maxPrice && r.priceFromUsd > Number(maxPrice)) return false;
      return true;
    });
  }, [all, university, zoneSet, roomTypeSet, availability, maxPrice]);

  const hasFilters = university.trim() !== "" || zoneSet.size > 0 || roomTypeSet.size > 0 || availability !== "" || maxPrice !== "";
  const clearFilters = () => {
    setUniversity("");
    setZoneSet(new Set());
    setRoomTypeSet(new Set());
    setAvailability("");
    setMaxPrice("");
    setOpenPill(null);
  };
  const togglePill = (name: string) => setOpenPill((current) => (current === name ? null : name));

  return (
    <div>
      {/* Cerrar dropdowns al clickear afuera */}
      {openPill && <div className="fixed inset-0 z-10" onClick={() => setOpenPill(null)} aria-hidden />}

      {/* Buscador por universidad — ref: campo "Universidad: Ej UBA, UADE, UCA" */}
      <div className="rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card sm:p-5">
        <label htmlFor="filter-university" className="mb-1.5 block text-sm font-bold text-ink">
          Universidad
        </label>
        <div className="relative">
          <Icon name="school" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-ink-faint" />
          <input
            id="filter-university"
            type="search"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="Ej: UBA, UADE, Universidad de Palermo…"
            className="w-full rounded-field border-[1.5px] border-line bg-cream py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-ink-faint focus:border-forest focus:outline-none"
          />
        </div>
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
          label="Disponibilidad"
          activeCount={availability ? 1 : 0}
          open={openPill === "availability"}
          onToggle={() => togglePill("availability")}
        >
          {AVAILABILITY_OPTIONS.map((o) => (
            <RadioOption
              key={o.value}
              label={o.label}
              checked={availability === o.value}
              onChange={() => {
                setAvailability(o.value);
                setOpenPill(null);
              }}
            />
          ))}
        </FilterPill>

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

      <p className="mb-5 mt-6 text-sm font-semibold text-forest-700">
        {filtered.length} {filtered.length === 1 ? "residencia encontrada" : "residencias encontradas"}
      </p>

      {filtered.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ResidenceCard key={r.slug} residence={r} arsPerUsd={arsPerUsd} />
          ))}
        </div>
      ) : (
        <EmptyState
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
