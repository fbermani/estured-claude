"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { OwnerResidenceCard } from "@/components/residences/OwnerResidenceCard";

type StatusTone = "neutral" | "amber" | "sage";

type CardData = {
  residenceId: string;
  name: string;
  zone: string;
  photoUrl: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  occupancyFull: boolean;
  occupied: number;
  capacity: number;
  newApplications: number;
  renewalsPending: number;
  supportOpen: number;
  avgPriceUsd: number | null;
};

/**
 * Selector/filtro de residencias (docs/12 §15.1: "Habrá un
 * filtro/selector en la parte superior para mostrar solo las
 * residencias que el owner quiera ver en ese momento. Si el owner
 * tiene una sola residencia, el filtro no se muestra."). Filtro por
 * texto (nombre/zona) + por estado — sin buscador de servidor, alcanza
 * con filtrar en el cliente hasta el máximo de 10 residencias por
 * owner (docs/00 §25.1).
 */
export function OwnerResidenceGrid({ cards, arsPerUsd }: { cards: CardData[]; arsPerUsd: number }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const statuses = useMemo(() => Array.from(new Set(cards.map((c) => c.statusLabel))), [cards]);

  const filtered = cards.filter((c) => {
    const matchesQuery =
      query.trim() === "" ||
      c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      c.zone.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = !statusFilter || c.statusLabel === statusFilter;
    return matchesQuery && matchesStatus;
  });

  if (cards.length <= 1) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <OwnerResidenceCard key={card.residenceId} {...card} arsPerUsd={arsPerUsd} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-ink-faint" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o zona…"
            className="w-full rounded-full border-[1.5px] border-line-2 bg-paper py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              statusFilter === null ? "bg-forest text-white" : "bg-cream-2 text-ink-soft hover:bg-sand-200"
            }`}
          >
            Todas ({cards.length})
          </button>
          {statuses.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setStatusFilter(label)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                statusFilter === label ? "bg-forest text-white" : "bg-cream-2 text-ink-soft hover:bg-sand-200"
              }`}
            >
              {label} ({cards.filter((c) => c.statusLabel === label).length})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-card border-[1.5px] border-dashed border-line-2 bg-cream px-6 py-10 text-center text-sm text-ink-soft">
          Ninguna residencia coincide con la búsqueda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <OwnerResidenceCard key={card.residenceId} {...card} arsPerUsd={arsPerUsd} />
          ))}
        </div>
      )}
    </div>
  );
}
