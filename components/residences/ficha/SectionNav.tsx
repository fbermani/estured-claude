"use client";

import { useEffect, useState } from "react";

export type SectionNavItem = {
  id: string;
  label: string;
  /** Número del capítulo («01»). Es decorativo para lectores de pantalla: el vínculo se llama como el capítulo. */
  number?: string;
};

/**
 * Navegación de capítulos de la ficha (propuesta A, fase 3): chips de ancla con scrollspy, fijos debajo de la navbar (h-16), a todo el
 * ancho de la página. Es el ÚNICO elemento sticky de la ficha además de la navbar. El capítulo activo lleva `aria-current` y el fondo
 * forest-ink; cada chip mide 44 px de alto. Sin JS de scroll propio: `IntersectionObserver` marca el capítulo activo y los links son
 * anclas nativas (con JS desactivado la navegación funciona igual, solo sin marcar el activo). En pantallas angostas la tira de chips
 * se desplaza sola, sin generar scroll horizontal de la página.
 */
export function SectionNav({
  items,
  label = "Secciones de la ficha",
  className = "sticky top-[var(--ficha-navbar-h,4.0625rem)] z-30",
  rootMargin = "-140px 0px -55% 0px",
}: {
  items: SectionNavItem[];
  /** Nombre accesible del `<nav>` (también ubica la pestaña activa). */
  label?: string;
  /** Posición/visibilidad del contenedor (por defecto, debajo de la navbar: `--ficha-navbar-h`; la altura de la barra es `--ficha-chips-h`, ver `lib/residences/fichaLayout.ts`). */
  className?: string;
  rootMargin?: string;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        // La activa es la visible más alta de la ventana (la primera en el orden de lectura).
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      // Banda de lectura: desde debajo de la navbar + subnav hasta ~45% de la ventana.
      { rootMargin, threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items, rootMargin]);

  // Mantiene visible la pestaña activa dentro de la tira con scroll horizontal (sin mover la página).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`nav[aria-label="${label}"] a[href="#${active}"]`);
    const list = el?.closest("ul");
    if (!el || !list) return;
    const a = el.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    const target = list.scrollLeft + (a.left - l.left) - (l.width - a.width) / 2;
    list.scrollTo({ left: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active, label]);

  return (
    <nav aria-label={label} className={`${className} flex h-[var(--ficha-chips-h,3.9rem)] items-center border-b-[1.5px] border-line-2 bg-cream`}>
      <div className="mx-auto w-full max-w-6xl px-2 sm:px-4">
        <ul className="flex gap-2 overflow-x-auto px-2 py-2 [mask-image:linear-gradient(90deg,#000_92%,transparent)] [scrollbar-width:none] lg:[mask-image:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-colors duration-200 ease-out-fresh ${
                    isActive
                      ? "border-forest-ink bg-forest-ink text-paper"
                      : "border-line-2 bg-paper text-ink-soft hover:border-forest-700 hover:text-ink"
                  }`}
                >
                  {item.number && (
                    <span aria-hidden="true" className={`tabular-nums ${isActive ? "text-[color:var(--paper-88)]" : "text-ink-faint"}`}>
                      {item.number}
                    </span>
                  )}
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
