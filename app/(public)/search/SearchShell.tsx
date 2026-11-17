"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { UNIVERSITY_CATEGORIES, UNIVERSITY_CATEGORY_ORDER, type UniversityCategory } from "@/lib/maps/universityPins";
import { PARAM_NAMES, type FilterGroupKey, type SearchFilters, type SortKey, type ViewMode } from "@/lib/residences/searchFilters";

/**
 * Filtros estilo Booking de /search (propuesta B, 2026-10-29): columna a la izquierda en desktop y hoja a pantalla
 * completa en mobile. Cada cambio actualiza los query params (`router.push` para que Atrás/Adelante recorra los pasos, sin scroll, dentro de una transición) y
 * el servidor vuelve a calcular resultados y contadores; no hay botón «aplicar». El presupuesto se aplica al soltar el
 * control. Los resultados llegan como `children` (Server Components).
 */

/** `category`: solo en «Universidad cercana» (UBA · otras públicas · privadas); agrupa las opciones y lleva el mismo color que los pines del mapa. */
export type FilterOption = { value: string; label: string; count: number; icon?: string; category?: UniversityCategory };
export type FilterGroup = { key: FilterGroupKey; title: string; hint?: string; options: FilterOption[]; show: number };

const SORT_LABELS: Record<SortKey, string> = { rec: "Recomendadas", pa: "Precio: menor a mayor", pd: "Precio: mayor a menor" };
const VIEWS: { key: ViewMode; label: string; icon: string }[] = [
  { key: "lista", label: "Lista", icon: "view_agenda" },
  { key: "grilla", label: "Grilla", icon: "grid_view" },
  { key: "mapa", label: "Mapa", icon: "map" },
];
const CHIP_PREFIX: Partial<Record<FilterGroupKey, string>> = { uni: "Cerca de ", room: "Hab. " };
const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest";
/** Panel fijo desde 900 px; por debajo, hoja a pantalla completa. */
const DESKTOP = "(min-width: 900px)";

type Props = {
  groups: FilterGroup[];
  filters: SearchFilters;
  bounds: { min: number; max: number };
  histogram: number[];
  promoCount: number;
  minorCount: number;
  communityCount: number;
  activeCount: number;
  resultCount: number;
  children: React.ReactNode;
};

export function SearchShell({ groups, filters, bounds, histogram, promoCount, minorCount, communityCount, activeCount, resultCount, children }: Props) {
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

  // M8: al cambiar los filtros (cambia la URL) la lista entra con un fundido 0→1 de 180 ms (`--ease-out-fresh`), sin
  // desplazamiento. No corre en la primera carga ni con «reducir movimiento».
  const resultsRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = resultsRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof el.animate !== "function") return;
    const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out-fresh").trim() || "ease-out";
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: ease });
  }, [currentQs]);

  const push = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(pendingQs.current ?? currentQs);
    mutate(p);
    const qs = p.toString();
    pendingQs.current = qs;
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  const setList = (p: URLSearchParams, key: FilterGroupKey, list: string[]) => {
    if (list.length > 0) p.set(PARAM_NAMES[key], list.join(","));
    else p.delete(PARAM_NAMES[key]);
  };
  const toggle = (key: FilterGroupKey, value: string) => {
    const cur = filters[key];
    push((p) => setList(p, key, cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));
  };
  const setFlag = (param: "promo" | "menores" | "comunidad", on: boolean) => push((p) => (on ? p.set(param, "1") : p.delete(param)));
  const setPrice = (min: number | null, max: number | null) =>
    push((p) => {
      if (min !== null) p.set("min", String(min)); else p.delete("min");
      if (max !== null) p.set("max", String(max)); else p.delete("max");
    });
  const clearAll = () =>
    push((p) => {
      [...Object.values(PARAM_NAMES), "promo", "menores", "comunidad", "min", "max"].forEach((k) => p.delete(k));
    });

  // Hoja mobile: Esc cierra, foco al botón de cerrar, devuelve el foco al abrir, y se bloquea el scroll de fondo.
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
      const items = [...asideRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, select, a[href]")].filter((el) => el.offsetParent !== null || el.classList.contains("peer"));
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
    // Si la ventana pasa a desktop con la hoja abierta, se cierra y se restaura el scroll.
    const mq = window.matchMedia(DESKTOP);
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

  const fmtPrice = `USD ${filters.pmin ?? bounds.min} – ${filters.pmax !== null ? filters.pmax : `${bounds.max}+`}`;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...groups.flatMap((g) =>
      filters[g.key].map((v) => ({
        key: `${g.key}:${v}`,
        label: (CHIP_PREFIX[g.key] ?? "") + (g.options.find((o) => o.value === v)?.label ?? v),
        remove: () => toggle(g.key, v),
      })),
    ),
    ...(filters.promo ? [{ key: "promo", label: "Con promoción", remove: () => setFlag("promo", false) }] : []),
    ...(filters.minor ? [{ key: "menores", label: "Admite menores de 18", remove: () => setFlag("menores", false) }] : []),
    ...(filters.community ? [{ key: "comunidad", label: "Con comunidad activa", remove: () => setFlag("comunidad", false) }] : []),
    ...(filters.pmin !== null || filters.pmax !== null ? [{ key: "precio", label: fmtPrice, remove: () => setPrice(null, null) }] : []),
  ];

  return (
    <div className="min-[900px]:grid min-[900px]:grid-cols-[18rem_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-6">
      <aside
        ref={asideRef}
        id="search-filters"
        aria-label="Filtros"
        {...(drawer ? { role: "dialog", "aria-modal": true } : {})}
        className={
          drawer
            ? "fixed inset-0 z-[60] flex flex-col bg-paper motion-safe:transition-[transform,opacity] motion-safe:duration-300 starting:translate-y-6 starting:opacity-0 min-[900px]:static min-[900px]:z-auto min-[900px]:block min-[900px]:rounded-card min-[900px]:border-[1.5px] min-[900px]:border-line min-[900px]:shadow-card"
            : "hidden min-[900px]:sticky min-[900px]:top-20 min-[900px]:block min-[900px]:max-h-[calc(100vh-6rem)] min-[900px]:overflow-y-auto min-[900px]:overscroll-contain min-[900px]:[scrollbar-width:thin] min-[900px]:[scrollbar-color:var(--color-line-2)_transparent] min-[900px]:rounded-card min-[900px]:border-[1.5px] min-[900px]:border-line min-[900px]:bg-paper min-[900px]:shadow-card"
        }
      >
        <div className="max-[899px]:sticky max-[899px]:top-0 z-10 flex items-center justify-between border-b border-line bg-paper px-4 py-3 min-[900px]:hidden">
          <h2 className="text-lg">Filtros</h2>
          <button ref={closeBtn} type="button" onClick={() => setDrawer(false)} aria-label="Cerrar filtros" className={`flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-cream-2 ${FOCUS}`}>
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <div className={drawer ? "flex-1 overflow-y-auto min-[900px]:overflow-visible" : ""}>
          <div className="hidden items-center justify-between px-[18px] pb-1.5 pt-4 min-[900px]:flex">
            <h2 className="text-[17px]">Filtrar por</h2>
            <LinkBtn onClick={clearAll} disabled={activeCount === 0}>Borrar todo</LinkBtn>
          </div>
          <PriceGroup key={`${filters.pmin}-${filters.pmax}`} bounds={bounds} histogram={histogram} filters={filters} onChange={setPrice} />
          <CommunityToggle count={communityCount} checked={filters.community} onChange={() => setFlag("comunidad", !filters.community)} />
          {groups.map((g) => (
            <OptionGroup key={g.key} group={g} selected={filters[g.key]} onToggle={(v) => toggle(g.key, v)} />
          ))}
          <section className="border-t border-line px-[18px] pb-3 pt-3.5" aria-labelledby="g-otros">
            <h3 id="g-otros" className="mb-2 text-[15px]">Otros</h3>
            <Row label="Con promoción vigente" count={promoCount} checked={filters.promo} onChange={() => setFlag("promo", !filters.promo)} />
            <Row label="Admite menores de 18" count={minorCount} checked={filters.minor} onChange={() => setFlag("menores", !filters.minor)} />
          </section>
        </div>
        <div className="sticky bottom-0 flex gap-2.5 border-t border-line bg-paper px-4 py-3 min-[900px]:hidden">
          <button type="button" onClick={clearAll} disabled={activeCount === 0} className={`min-h-[44px] flex-1 cursor-pointer rounded-full border-[1.5px] border-line-2 text-sm font-bold text-ink-soft hover:bg-cream-2 disabled:cursor-default disabled:opacity-50 ${FOCUS}`}>
            Borrar todo
          </button>
          <button type="button" onClick={() => setDrawer(false)} className={`min-h-[44px] flex-[2] cursor-pointer rounded-full bg-forest text-sm font-bold text-white hover:bg-forest-600 ${FOCUS}`}>
            {resultCount === 0 ? "Sin resultados" : `Ver ${resultCount} ${resultCount === 1 ? "residencia" : "residencias"}`}
          </button>
        </div>
      </aside>

      <section aria-label="Resultados" className="min-w-0">
        <div className="sticky top-16 z-30 -mx-0.5 bg-cream py-2.5 min-[900px]:hidden">
          <button
            ref={openBtn}
            type="button"
            onClick={() => setDrawer(true)}
            aria-expanded={drawer}
            aria-controls="search-filters"
            className={`flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-[14.5px] font-bold text-ink-soft hover:bg-cream-2 ${FOCUS}`}
          >
            <Icon name="tune" className="text-lg" />
            Filtros
            {activeCount > 0 && <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1.5 text-xs font-bold text-white">{activeCount}</span>}
          </button>
        </div>

        <div className="mb-2.5 mt-0.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 aria-live="polite" className="w-full text-xl sm:w-auto">
            {resultCount} {resultCount === 1 ? "residencia encontrada" : "residencias encontradas"}
          </h2>
          <div className="flex w-full items-center justify-between gap-2 sm:contents">
          <div role="group" aria-label="Cómo ver los resultados" className="inline-flex rounded-full bg-cream-2 p-[3px]">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={filters.view === v.key}
                onClick={() => push((p) => (v.key === "grilla" ? p.delete("vista") : p.set("vista", v.key)))}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-[13.5px] sm:px-3.5 font-semibold ${FOCUS} ${
                  filters.view === v.key ? "bg-paper text-forest-700 shadow-card" : "text-ink-soft hover:text-ink"
                }`}
              >
                <span aria-hidden="true" className="inline-flex max-sm:hidden"><Icon name={v.icon} className="text-lg" /></span>
                {v.label}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
            <span aria-hidden="true" className="max-sm:hidden">Ordenar por</span>
            <select
              aria-label="Ordenar por"
              value={filters.sort}
              onChange={(e) => push((p) => (e.target.value === "rec" ? p.delete("orden") : p.set("orden", e.target.value)))}
              className={`min-h-[42px] min-w-0 cursor-pointer rounded-field border-[1.5px] border-field-border bg-paper py-0 pl-3 pr-3 text-sm font-semibold text-ink ${FOCUS}`}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </label>
          </div>
        </div>

        {chips.length > 0 && (
          <ul aria-label="Filtros activos" className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] min-[900px]:flex-wrap min-[900px]:overflow-visible min-[900px]:pb-0">
            {chips.map((c) => (
              <li key={c.key} className="shrink-0">
                <button type="button" onClick={c.remove} aria-label={`Quitar filtro ${c.label}`} className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-sage-200 bg-forest-tint py-0 pl-3 pr-2 text-[13px] font-semibold text-forest-700 hover:bg-sage-100 ${FOCUS}`}>
                  {c.label}
                  <Icon name="close" className="text-base" />
                </button>
              </li>
            ))}
            <li className="shrink-0">
              <LinkBtn onClick={clearAll}>Borrar todo</LinkBtn>
            </li>
          </ul>
        )}

        <div aria-busy={pending} className={`${pending ? "opacity-45" : ""} motion-safe:transition-opacity`}>
          <div ref={resultsRef}>{children}</div>
        </div>
      </section>
    </div>
  );
}

/** Botón con aspecto de enlace (acciones «Borrar todo» y «Mostrar más»). */
function LinkBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-field px-0.5 py-1.5 text-[13.5px] font-semibold text-forest-700 underline underline-offset-[3px] hover:text-forest-600 disabled:cursor-default disabled:text-ink-faint disabled:no-underline ${FOCUS}`}
    >
      {children}
    </button>
  );
}

function Row({ label, count, checked, onChange, icon }: { label: string; count: number; checked: boolean; onChange: () => void; icon?: string }) {
  const muted = count === 0 && !checked;
  return (
    <label className={`-mx-1 flex min-h-[34px] cursor-pointer items-center gap-2.5 rounded-field px-1 py-[3px] text-[14.5px] hover:bg-cream has-[:focus-visible]:bg-forest-tint has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-forest-ink ${muted ? "text-ink-faint" : "text-ink"}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="grid size-5 flex-none place-items-center rounded-field border-[1.75px] border-ink-faint bg-white after:h-2.5 after:w-[5px] after:-translate-y-px after:rotate-45 after:border-b-[2.25px] after:border-r-[2.25px] after:border-white after:opacity-0 after:content-[''] motion-safe:transition-colors peer-checked:border-forest peer-checked:bg-forest peer-checked:after:opacity-100 peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest-ink"
      />
      {icon && <Icon name={icon} className="text-lg text-ink-faint" />}
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
      <span className="text-[13px] tabular-nums text-ink-faint" aria-label={`${count} resultados`}>{count}</span>
    </label>
  );
}

/** Interruptor destacado justo bajo el presupuesto: «solo residencias con comunidad activa» (residentes viviendo hoy). */
function CommunityToggle({ count, checked, onChange }: { count: number; checked: boolean; onChange: () => void }) {
  const muted = count === 0 && !checked;
  return (
    <div className="border-t border-line px-[18px] py-3.5">
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-card border-[1.5px] px-3 py-2.5 motion-safe:transition-colors has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-ink ${checked ? "border-forest bg-forest-tint" : "border-line-2 bg-cream hover:border-forest"} ${muted ? "opacity-70" : ""}`}
      >
        <input type="checkbox" role="switch" checked={checked} onChange={onChange} className="peer sr-only" />
        <Icon name="groups" className="text-2xl text-forest-700" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[14.5px] font-bold text-ink">Comunidad activa</span>
          <span className="block text-[12.5px] text-ink-soft">
            <span className="tabular-nums">{count}</span> {count === 1 ? "residencia" : "residencias"} con estudiantes viviendo hoy
          </span>
        </span>
        <span
          aria-hidden="true"
          className="relative h-6 w-10 flex-none rounded-full bg-line-2 motion-safe:transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:content-[''] motion-safe:after:transition-transform peer-checked:bg-forest peer-checked:after:translate-x-4"
        />
      </label>
    </div>
  );
}

/**
 * «Universidad cercana»: a la vista solo las de la UBA; «Mostrar más» despliega las categorías (UBA, otras públicas, privadas)
 * como secciones plegables, con el color de referencia de los pines del mapa. Las elegidas siempre quedan a la vista.
 */
function UniversityGroup({ group, selected, onToggle }: { group: FilterGroup; selected: string[]; onToggle: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const titleId = `g-${group.key}`;
  const uba = group.options.filter((o) => o.category === "uba");
  const others = group.options.filter((o) => o.category !== "uba");
  const hiddenSelected = others.filter((o) => selected.includes(o.value));
  const visible = expanded ? [] : [...uba, ...hiddenSelected];
  return (
    <section className="border-t border-line px-[18px] pb-3 pt-3.5" aria-labelledby={titleId}>
      <h3 id={titleId} className="mb-2 text-[15px]">{group.title}</h3>
      {!expanded && uba.length > 0 && (
        <p className="-mt-1 mb-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-faint">
          <span aria-hidden="true" className={`size-2.5 rounded-full ${UNIVERSITY_CATEGORIES.uba.dot}`} />
          UBA
        </p>
      )}
      {!expanded && (
        <div role="group" aria-labelledby={titleId}>
          {visible.map((o) => (
            <Row key={o.value} label={o.label} count={o.count} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
          ))}
        </div>
      )}
      {expanded && (
        <div role="group" aria-labelledby={titleId} className="space-y-1">
          {UNIVERSITY_CATEGORY_ORDER.map((cat) => {
            const list = group.options.filter((o) => (o.category ?? "private") === cat);
            if (list.length === 0) return null;
            const meta = UNIVERSITY_CATEGORIES[cat];
            const picked = list.filter((o) => selected.includes(o.value)).length;
            return (
              <details key={cat} open={cat === "uba" || picked > 0} className="group/cat rounded-field border border-line">
                <summary className={`flex min-h-10 cursor-pointer list-none items-center gap-2 px-2.5 text-[14px] font-bold text-ink [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                  <span aria-hidden="true" className={`size-3 flex-none rounded-full ${meta.dot}`} />
                  <span className="min-w-0 flex-1">{meta.label}</span>
                  {picked > 0 && <span className="rounded-full bg-forest px-1.5 text-[11px] font-bold tabular-nums text-white">{picked}</span>}
                  <span className="text-[13px] font-normal tabular-nums text-ink-faint">{list.length}</span>
                  <Icon name="expand_more" className="text-xl text-ink-faint motion-safe:transition-transform group-open/cat:rotate-180" />
                </summary>
                <div className="border-t border-line px-2.5 py-1">
                  {list.map((o) => (
                    <Row key={o.value} label={o.label} count={o.count} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-1">
          <LinkBtn onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Mostrar menos" : `Mostrar más: públicas y privadas (${others.length})`}
          </LinkBtn>
        </div>
      )}
    </section>
  );
}

function OptionGroup({ group, selected, onToggle }: { group: FilterGroup; selected: string[]; onToggle: (v: string) => void }) {
  if (group.key === "uni" && group.options.some((o) => o.category)) return <UniversityGroup group={group} selected={selected} onToggle={onToggle} />;
  return <PlainOptionGroup group={group} selected={selected} onToggle={onToggle} />;
}

function PlainOptionGroup({ group, selected, onToggle }: { group: FilterGroup; selected: string[]; onToggle: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  // Las opciones elegidas siempre se ven, aunque caigan en la parte plegada.
  const visible = group.options.filter((o, i) => expanded || i < group.show || selected.includes(o.value));
  const hidden = group.options.length - visible.length;
  if (group.options.length === 0) return null;
  const titleId = `g-${group.key}`;
  return (
    <section className="border-t border-line px-[18px] pb-3 pt-3.5" aria-labelledby={titleId}>
      <h3 id={titleId} className="mb-2 text-[15px]">{group.title}</h3>
      {group.hint && <p className="-mt-1 mb-2 text-[12.5px] text-ink-faint">{group.hint}</p>}
      <div role="group" aria-labelledby={titleId}>
        {visible.map((o) => (
          <Row key={o.value} label={o.label} count={o.count} icon={o.icon} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
        ))}
      </div>
      {(hidden > 0 || expanded) && group.options.length > group.show && (
        <div className="mt-1">
          <LinkBtn onClick={() => setExpanded((v) => !v)}>{expanded ? "Mostrar menos" : `Mostrar ${hidden} más`}</LinkBtn>
        </div>
      )}
    </section>
  );
}

const THUMB =
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-[22px] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-forest [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-card " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[2.5px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-forest [&::-moz-range-thumb]:bg-white " +
  "focus-visible:[&::-webkit-slider-thumb]:outline-[3px] focus-visible:[&::-webkit-slider-thumb]:outline-offset-2 focus-visible:[&::-webkit-slider-thumb]:outline-forest focus-visible:[&::-moz-range-thumb]:outline-[3px] focus-visible:[&::-moz-range-thumb]:outline-offset-2 focus-visible:[&::-moz-range-thumb]:outline-forest";

/**
 * Presupuesto: histograma de precios y dos controles `range` superpuestos (mínimo y máximo), con teclado (flechas, Inicio, Fin).
 * Se aplica al soltar (o al terminar de usar el teclado), no en cada movimiento. Mínimo en el piso o máximo en el techo = sin
 * extremo («USD 600+»): el query param se borra, igual que antes.
 */
function PriceGroup({ bounds, histogram, filters, onChange }: { bounds: { min: number; max: number }; histogram: number[]; filters: SearchFilters; onChange: (min: number | null, max: number | null) => void }) {
  const STEP = 10;
  const [lo, setLo] = useState(filters.pmin ?? bounds.min);
  const [hi, setHi] = useState(filters.pmax ?? bounds.max);
  if (bounds.max === 0 || bounds.max - bounds.min < STEP) return null;
  const clamp = (v: number) => Math.min(bounds.max, Math.max(bounds.min, v));
  const a = clamp(lo);
  const b = clamp(hi);
  const span = bounds.max - bounds.min;
  const commit = () => {
    const nextMin = a <= bounds.min ? null : a;
    const nextMax = b >= bounds.max ? null : b;
    if (nextMin === filters.pmin && nextMax === filters.pmax) return;
    onChange(nextMin, nextMax);
  };
  const peak = Math.max(1, ...histogram);
  const binW = span / histogram.length;
  const fmt = (v: number) => (v >= bounds.max ? `USD ${v}+` : `USD ${v}`);
  const range = "pointer-events-none absolute -left-0.5 top-0.5 m-0 h-6 w-[calc(100%+4px)] appearance-none bg-transparent";
  return (
    <section className="px-[18px] pb-3 pt-1.5" aria-labelledby="g-price">
      <h3 id="g-price" className="mb-2 text-[15px]">Presupuesto mensual</h3>
      <div aria-hidden="true" className="mx-1 mt-1.5 flex h-11 items-end gap-0.5">
        {histogram.map((n, i) => {
          const out = bounds.min + (i + 1) * binW <= a || bounds.min + i * binW >= b;
          return <i key={i} style={{ height: `${(n / peak) * 100}%` }} className={`min-h-0.5 flex-1 rounded-t-[3px] bg-forest motion-safe:transition-[height,opacity] ${out ? "opacity-20" : "opacity-90"}`} />;
        })}
      </div>
      <div className="relative mx-1 h-7">
        <div className="absolute inset-x-0 top-3 h-1 rounded bg-line-2" />
        <div className="absolute top-3 h-1 rounded bg-forest" style={{ left: `${((a - bounds.min) / span) * 100}%`, right: `${(1 - (b - bounds.min) / span) * 100}%` }} />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={STEP}
          value={a}
          aria-label="Precio mínimo en USD por mes"
          aria-valuetext={fmt(a)}
          onChange={(e) => setLo(Math.min(Number(e.target.value), b - STEP))}
          onPointerUp={commit}
          onPointerCancel={commit}
          onKeyUp={commit}
          className={`${range} ${THUMB}`}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={STEP}
          value={b}
          aria-label="Precio máximo en USD por mes"
          aria-valuetext={fmt(b)}
          onChange={(e) => setHi(Math.max(Number(e.target.value), a + STEP))}
          onPointerUp={commit}
          onPointerCancel={commit}
          onKeyUp={commit}
          className={`${range} ${THUMB}`}
        />
      </div>
      <p className="mx-1 mt-0.5 flex justify-between text-[13.5px] font-semibold text-ink">
        <span>{fmt(a)}</span>
        <span aria-hidden="true">—</span>
        <span>{fmt(b)}</span>
      </p>
      <p className="mx-1 mt-1.5 text-xs text-ink-faint">Precio «desde» por persona, en USD.</p>
    </section>
  );
}
