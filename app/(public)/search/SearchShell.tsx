"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { PARAM_NAMES, type FilterGroupKey, type SearchFilters, type SortKey } from "@/lib/residences/searchFilters";

/**
 * Filtros estilo Booking de /search (propuesta B, 2026-10-29): columna a la izquierda en desktop y panel
 * deslizable en mobile. Cada click actualiza los query params (`router.replace`, sin scroll, dentro de una
 * transición) y el servidor vuelve a calcular resultados y contadores; no hay botón «aplicar». Los
 * resultados llegan como `children` (Server Components).
 */

export type FilterOption = { value: string; label: string; count: number; icon?: string };
export type FilterGroup = { key: FilterGroupKey; title: string; hint?: string; options: FilterOption[]; show: number };

const SORT_LABELS: Record<SortKey, string> = { rec: "Recomendadas", pa: "Precio: menor a mayor", pd: "Precio: mayor a menor" };

type Props = {
  groups: FilterGroup[];
  filters: SearchFilters;
  bounds: { min: number; max: number };
  promoCount: number;
  minorCount: number;
  activeCount: number;
  resultCount: number;
  children: React.ReactNode;
};

export function SearchShell({ groups, filters, bounds, promoCount, minorCount, activeCount, resultCount, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState(false);
  const openBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // URL pendiente: en clicks rápidos, la siguiente mutación parte de la última URL pedida y no pisa la anterior.
  const pendingQs = useRef<string | null>(null);
  const currentQs = searchParams.toString();
  useEffect(() => {
    pendingQs.current = null;
  }, [currentQs]);
  const asideRef = useRef<HTMLElement>(null);

  const push = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(pendingQs.current ?? currentQs);
    mutate(p);
    const qs = p.toString();
    pendingQs.current = qs;
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  const setList = (p: URLSearchParams, key: FilterGroupKey, list: string[]) => {
    if (list.length > 0) p.set(PARAM_NAMES[key], list.join(","));
    else p.delete(PARAM_NAMES[key]);
  };
  const toggle = (key: FilterGroupKey, value: string) => {
    const cur = filters[key];
    push((p) => setList(p, key, cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));
  };
  const setFlag = (param: "promo" | "menores", on: boolean) => push((p) => (on ? p.set(param, "1") : p.delete(param)));
  const setPrice = (min: number | null, max: number | null) =>
    push((p) => {
      if (min !== null) p.set("min", String(min)); else p.delete("min");
      if (max !== null) p.set("max", String(max)); else p.delete("max");
    });
  const clearAll = () =>
    push((p) => {
      [...Object.values(PARAM_NAMES), "promo", "menores", "min", "max"].forEach((k) => p.delete(k));
    });

  // Panel mobile: Esc cierra, foco al botón de cerrar, devuelve el foco al abrir, y se bloquea el scroll de fondo.
  useEffect(() => {
    if (!drawer) return;
    const trigger = openBtn.current;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setDrawer(false);
      if (e.key !== "Tab" || !asideRef.current) return;
      // Focus trap simple dentro del panel.
      const items = [...asideRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, select, a[href]")].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!asideRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    // Si la ventana pasa a desktop con el panel abierto, se cierra y se restaura el scroll.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setDrawer(false);
    mq.addEventListener("change", onMq);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      mq.removeEventListener("change", onMq);
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [drawer]);

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...groups.flatMap((g) =>
      filters[g.key].map((v) => ({
        key: `${g.key}:${v}`,
        label: g.options.find((o) => o.value === v)?.label ?? v,
        remove: () => toggle(g.key, v),
      })),
    ),
    ...(filters.promo ? [{ key: "promo", label: "Con promoción", remove: () => setFlag("promo", false) }] : []),
    ...(filters.minor ? [{ key: "menores", label: "Admite menores de 18", remove: () => setFlag("menores", false) }] : []),
    ...(filters.pmin !== null || filters.pmax !== null
      ? [{ key: "precio", label: `USD ${filters.pmin ?? bounds.min}–${filters.pmax ?? bounds.max}`, remove: () => setPrice(null, null) }]
      : []),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {drawer && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setDrawer(false)} aria-hidden />}
      <aside
        ref={asideRef}
        id="search-filters"
        aria-label="Filtros"
        {...(drawer ? { role: "dialog", "aria-modal": true } : {})}
        className={
          drawer
            ? "fixed inset-y-0 left-0 z-50 flex w-[min(22rem,92vw)] flex-col bg-paper shadow-float lg:static lg:z-auto lg:w-auto lg:bg-transparent lg:shadow-none"
            : "hidden lg:sticky lg:top-4 lg:block"
        }
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <h2 className="text-base font-extrabold text-ink">Filtros</h2>
          <button ref={closeBtn} type="button" onClick={() => setDrawer(false)} aria-label="Cerrar filtros" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-forest">
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 lg:max-h-[calc(100vh-2rem)] lg:rounded-card lg:border-[1.5px] lg:border-line lg:bg-paper lg:p-5 lg:shadow-card">
          <div className="mb-3 hidden items-center justify-between lg:flex">
            <h2 className="text-base font-extrabold text-ink">Filtrar por</h2>
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="cursor-pointer text-sm font-semibold text-forest-700 underline-offset-2 hover:underline">
                Borrar todo
              </button>
            )}
          </div>
          <PriceGroup key={`${filters.pmin}-${filters.pmax}`} bounds={bounds} filters={filters} onChange={setPrice} />
          {groups.map((g) => (
            <OptionGroup key={g.key} group={g} selected={filters[g.key]} onToggle={(v) => toggle(g.key, v)} />
          ))}
          <section className="border-t border-line py-4" aria-labelledby="g-otros">
            <h3 id="g-otros" className="mb-2 text-sm font-bold text-ink">Otros</h3>
            <Row label="Con promoción vigente" count={promoCount} checked={filters.promo} onChange={() => setFlag("promo", !filters.promo)} />
            <Row label="Admite menores de 18" count={minorCount} checked={filters.minor} onChange={() => setFlag("menores", !filters.minor)} />
          </section>
        </div>
        <div className="flex gap-2 border-t border-line px-4 py-3 lg:hidden">
          <button type="button" onClick={clearAll} disabled={activeCount === 0} className="flex-1 cursor-pointer rounded-field border-[1.5px] border-line-2 py-2.5 text-sm font-bold text-ink-soft disabled:opacity-50">
            Borrar todo
          </button>
          <button type="button" onClick={() => setDrawer(false)} className="flex-[2] cursor-pointer rounded-field bg-forest py-2.5 text-sm font-bold text-white hover:bg-forest-600">
            Ver {resultCount} {resultCount === 1 ? "residencia" : "residencias"}
          </button>
        </div>
      </aside>

      <section aria-label="Resultados" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 aria-live="polite" className="text-lg font-extrabold text-ink">
            {resultCount} {resultCount === 1 ? "residencia encontrada" : "residencias encontradas"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              ref={openBtn}
              type="button"
              onClick={() => setDrawer(true)}
              aria-expanded={drawer}
              aria-controls="search-filters"
              className="flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line bg-paper px-4 py-2 text-sm font-bold text-ink-soft lg:hidden"
            >
              <Icon name="tune" className="text-lg" />
              Filtros
              {activeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1 text-[11px] font-bold text-white">{activeCount}</span>}
            </button>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <span className="hidden sm:inline">Ordenar por</span>
              <select
                aria-label="Ordenar por"
                value={filters.sort}
                onChange={(e) => push((p) => (e.target.value === "rec" ? p.delete("orden") : p.set("orden", e.target.value)))}
                className="rounded-field border-[1.5px] border-field-border bg-paper py-2 pl-3 pr-8 text-sm text-ink focus:border-forest focus:outline-none"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>{SORT_LABELS[k]}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {chips.length > 0 && (
          <ul aria-label="Filtros activos" className="mt-3 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <li key={c.key}>
                <button type="button" onClick={c.remove} aria-label={`Quitar filtro ${c.label}`} className="flex cursor-pointer items-center gap-1 rounded-full bg-forest-tint px-3 py-1 text-xs font-semibold text-forest-700 hover:bg-forest-tint/70">
                  {c.label}
                  <Icon name="close" className="text-sm" />
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={clearAll} className="cursor-pointer text-xs font-semibold text-ink-soft underline-offset-2 hover:underline">Borrar todo</button>
            </li>
          </ul>
        )}
        <div aria-busy={pending} className={`mt-4 ${pending ? "opacity-60" : ""} motion-safe:transition-opacity`}>
          {children}
        </div>
      </section>
    </div>
  );
}

function Row({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 rounded-field px-1 py-1.5 text-sm hover:bg-cream-2 ${count === 0 && !checked ? "text-ink-faint" : "text-ink"}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 rounded border-line-2 accent-[var(--color-forest)]" />
      <span className="min-w-0 flex-1">{label}</span>
      <span className="text-xs tabular-nums text-ink-faint" aria-label={`${count} resultados`}>{count}</span>
    </label>
  );
}

function OptionGroup({ group, selected, onToggle }: { group: FilterGroup; selected: string[]; onToggle: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  // Las opciones elegidas siempre se ven, aunque caigan en la parte plegada.
  const visible = group.options.filter((o, i) => expanded || i < group.show || selected.includes(o.value));
  const hidden = group.options.length - visible.length;
  if (group.options.length === 0) return null;
  const titleId = `g-${group.key}`;
  return (
    <section className="border-t border-line py-4" aria-labelledby={titleId}>
      <h3 id={titleId} className="text-sm font-bold text-ink">{group.title}</h3>
      {group.hint && <p className="mb-1 text-xs text-ink-faint">{group.hint}</p>}
      <div role="group" aria-labelledby={titleId} className="mt-1">
        {visible.map((o) => (
          <Row key={o.value} label={o.label} count={o.count} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
        ))}
      </div>
      {(hidden > 0 || expanded) && group.options.length > group.show && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 cursor-pointer px-1 text-sm font-semibold text-forest-700 underline-offset-2 hover:underline">
          {expanded ? "Mostrar menos" : `Mostrar ${hidden} más`}
        </button>
      )}
    </section>
  );
}

/** Presupuesto: mínimo y máximo (USD, precio «desde»). Se aplica al salir del campo o con Enter. */
function PriceGroup({ bounds, filters, onChange }: { bounds: { min: number; max: number }; filters: SearchFilters; onChange: (min: number | null, max: number | null) => void }) {
  const [min, setMin] = useState(filters.pmin?.toString() ?? "");
  const [max, setMax] = useState(filters.pmax?.toString() ?? "");
  if (bounds.max === 0) return null;
  const commit = () => {
    const a = min === "" ? null : Math.max(0, Math.round(Number(min)));
    const b = max === "" ? null : Math.max(0, Math.round(Number(max)));
    const na = a !== null && Number.isFinite(a) && a > 0 ? a : null;
    const nb = b !== null && Number.isFinite(b) && b > 0 ? b : null;
    if (na === filters.pmin && nb === filters.pmax) return;
    onChange(na, nb);
  };
  const field = "w-full rounded-field border-[1.5px] border-field-border bg-paper py-2 pl-12 pr-2 text-sm text-ink focus:border-forest focus:outline-none";
  const onKey = (e: React.KeyboardEvent) => e.key === "Enter" && commit();
  return (
    <section className="pb-4" aria-labelledby="g-price">
      <h3 id="g-price" className="text-sm font-bold text-ink">Presupuesto mensual</h3>
      <p className="mb-2 text-xs text-ink-faint">Precio «desde» por persona, en USD.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="relative block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-faint">Desde</span>
          <input inputMode="numeric" type="number" min={0} step={10} value={min} placeholder={String(bounds.min)} onChange={(e) => setMin(e.target.value)} onBlur={commit} onKeyDown={onKey} aria-label="Precio mínimo en USD por mes" className={field} />
        </label>
        <label className="relative block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-faint">Hasta</span>
          <input inputMode="numeric" type="number" min={0} step={10} value={max} placeholder={String(bounds.max)} onChange={(e) => setMax(e.target.value)} onBlur={commit} onKeyDown={onKey} aria-label="Precio máximo en USD por mes" className={field} />
        </label>
      </div>
    </section>
  );
}
