"use client";

import { useMemo, useState } from "react";
import type { AvailabilityMode, RoomTypeName } from "@/types/domain";
import { getPublishedResidences, zones } from "@/lib/mock/residences";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const roomTypeOptions: RoomTypeName[] = [
  "Individual",
  "Doble",
  "Triple",
  "Cuádruple",
  "Compartida",
];

const availabilityOptions: { value: AvailabilityMode | ""; label: string }[] = [
  { value: "", label: "Cualquier disponibilidad" },
  { value: "real_by_place", label: "Disponibilidad asegurada" },
  { value: "by_room_type_to_confirm", label: "Disponibilidad informada" },
  { value: "full", label: "Completa (lista de espera)" },
];

export function SearchCatalog({ arsPerUsd }: { arsPerUsd: number }) {
  const [zone, setZone] = useState("");
  const [roomType, setRoomType] = useState("");
  const [availability, setAvailability] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const all = getPublishedResidences();

  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (zone && r.zone !== zone) return false;
      if (roomType && !r.roomTypes.some((rt) => rt.type === roomType))
        return false;
      if (availability && r.availabilityMode !== availability) return false;
      if (maxPrice && r.priceFromUsd > Number(maxPrice)) return false;
      return true;
    });
  }, [all, zone, roomType, availability, maxPrice]);

  const clearFilters = () => {
    setZone("");
    setRoomType("");
    setAvailability("");
    setMaxPrice("");
  };

  return (
    <div>
      <div className="mb-8 grid gap-4 rounded-card border border-sand-200 bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Barrio"
          id="filter-zone"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
        >
          <option value="">Todos los barrios</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
        <Select
          label="Tipo de habitación"
          id="filter-room"
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {roomTypeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select
          label="Disponibilidad"
          id="filter-availability"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
        >
          {availabilityOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          label="Precio máximo por mes"
          id="filter-price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        >
          <option value="">Sin límite</option>
          <option value="250">Hasta USD 250</option>
          <option value="300">Hasta USD 300</option>
          <option value="400">Hasta USD 400</option>
          <option value="500">Hasta USD 500</option>
        </Select>
      </div>

      <p className="mb-5 text-sm text-ink-faint">
        {filtered.length}{" "}
        {filtered.length === 1 ? "residencia encontrada" : "residencias encontradas"}
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
