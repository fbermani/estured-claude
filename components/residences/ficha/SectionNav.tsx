"use client";

import { useEffect, useState } from "react";

export type SectionNavItem = { id: string; label: string };

/**
 * Subnav sticky de la ficha (SPEC §3): anclas a las secciones con scrollspy. Debajo de la navbar (h-16).
 * Sin JS de scroll propio: `IntersectionObserver` marca la sección activa y los links son anclas nativas.
 */
export function SectionNav({ items }: { items: SectionNavItem[] }) {
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
      { rootMargin: "-130px 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="Secciones de la ficha"
      className="sticky top-16 z-30 -mx-4 border-b border-line bg-cream/95 px-4 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`relative flex h-12 items-center px-3.5 text-sm font-bold transition-colors duration-200 ease-fresh focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest ${
                  isActive ? "text-forest-700" : "text-ink-soft hover:text-ink"
                }`}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-forest transition-opacity duration-200 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
