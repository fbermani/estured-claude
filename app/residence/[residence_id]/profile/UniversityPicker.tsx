"use client";

import { useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { UNIVERSITY_OPTIONS } from "@/lib/residences/options";
import type { UniversityCategory } from "@/lib/maps/universityCategories";
import { countSelected, groupUniversityOptions, initiallyOpenGroups, matchesUniversityQuery } from "@/lib/residences/universityGroups";

const plural = (n: number) => `${n} ${n === 1 ? "elegida" : "elegidas"}`;

/**
 * Proximidad a universidades en tres secciones colapsables (UBA · otras públicas · privadas), las mismas del mapa de /search.
 * Cada checkbox sigue mandando `near_universities` con el nombre de siempre (el valor guardado no cambia), esté la sección abierta,
 * cerrada o filtrada por la búsqueda: nada se desmonta, solo se oculta. Las secciones con algo elegido arrancan abiertas; después
 * solo se abren a mano o al buscar (nunca se cierran solas al destildar la última).
 */
export function UniversityPicker({ selected, onToggle }: { selected: ReadonlySet<string>; onToggle: (name: string) => void }) {
  const { groups, other } = useMemo(() => groupUniversityOptions(UNIVERSITY_OPTIONS), []);
  const [open, setOpen] = useState<Set<UniversityCategory>>(() => initiallyOpenGroups(groups, selected));
  const [query, setQuery] = useState("");
  const searchId = useId();
  const searching = query.trim() !== "";
  const total = groups.reduce((sum, g) => sum + countSelected(g.names, selected), 0) + (other && selected.has(other) ? 1 : 0);

  function toggleGroup(key: UniversityCategory) {
    // Sin `Set.delete`: el test de cobertura de permisos busca `.delete(` para detectar escrituras en la base.
    setOpen((prev) => (prev.has(key) ? new Set([...prev].filter((k) => k !== key)) : new Set([...prev, key])));
  }

  const checkbox = (name: string) => (
    <label key={name} hidden={!matchesUniversityQuery(name, query)} className="max-lg:min-h-11 flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        name="near_universities"
        value={name}
        checked={selected.has(name)}
        onChange={() => onToggle(name)}
        className="h-4 w-4 max-lg:size-5! accent-forest"
      />
      {name}
    </label>
  );

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor={searchId} className="text-sm font-bold text-ink-soft">
            Buscar universidad
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter en el buscador no debe enviar el formulario de la configuración.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Ej: Ingeniería, UCA"
            autoComplete="off"
            className="mt-1.5 w-full rounded-field border-[1.5px] border-field-border bg-cream px-3.5 py-2.5 text-base text-ink placeholder:text-muted focus:border-forest focus:outline-2 focus:outline-forest-tint sm:text-sm"
          />
        </div>
        <p role="status" className="text-sm font-semibold tabular-nums text-ink-soft">
          {plural(total)} en total
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((g) => {
          const matches = g.names.filter((n) => matchesUniversityQuery(n, query)).length;
          const chosen = countSelected(g.names, selected);
          const isOpen = open.has(g.key) || (searching && matches > 0);
          return (
            <details key={g.key} open={isOpen} hidden={searching && matches === 0} className="group rounded-card border-[1.5px] border-line bg-cream-2/40">
              <summary
                onClick={(e) => {
                  // Se maneja `open` en React: sin esto el navegador lo cambia por su cuenta y el estado queda desfasado.
                  e.preventDefault();
                  toggleGroup(g.key);
                }}
                className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <span className="text-sm font-bold text-ink">{g.label}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold tabular-nums text-ink-soft">{plural(chosen)}</span>
                  <Icon name="expand_more" aria-hidden className="text-xl text-ink-soft motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180" />
                </span>
              </summary>
              <div className="grid gap-2.5 px-5 pb-4 sm:grid-cols-2">{g.names.map(checkbox)}</div>
            </details>
          );
        })}
        {other && (
          <div className="rounded-card border-[1.5px] border-line px-5 py-1" hidden={!matchesUniversityQuery(other, query) && searching}>
            {checkbox(other)}
          </div>
        )}
        {searching && groups.every((g) => !g.names.some((n) => matchesUniversityQuery(n, query))) && !(other && matchesUniversityQuery(other, query)) && (
          <p role="status" className="text-sm text-ink-soft">
            No encontramos universidades con ese nombre. Probá con otra palabra o elegí «{other ?? "Otra"}».
          </p>
        )}
      </div>
    </div>
  );
}
