"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Contenedor de tabla ancha con scroll horizontal: degradés en los bordes que
 * tienen más contenido, primera columna fija, región enfocable con Tab (se
 * desplaza con flechas) y pista «Deslizá para ver más columnas» bajo `md`.
 */
export function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdge({
        l: el.scrollLeft > 4,
        r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-petrol-600 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-white [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[1] [&_th:first-child]:bg-inherit [&_thead_tr]:bg-inherit"
      >
        {children}
      </div>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 z-[2] w-6 bg-gradient-to-r from-black/10 to-transparent transition-opacity ${edge.l ? "opacity-100" : "opacity-0"}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 z-[2] w-8 bg-gradient-to-l from-black/15 to-transparent transition-opacity ${edge.r ? "opacity-100" : "opacity-0"}`}
      />
      {edge.r && <p className="px-4 py-2 text-xs text-ink-faint md:hidden">Deslizá para ver más columnas</p>}
    </div>
  );
}
