"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type TocItem = { id: string; label: string };

/**
 * Índice de contenidos de la guía: columna sticky en desktop (con scrollspy) y bloque colapsable en móvil.
 * Los links son anclas nativas; `IntersectionObserver` solo marca la sección activa.
 */
export function GuideToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  const list = (onPick?: () => void) => (
    <ol className="grid gap-0.5">
      {items.map((item, n) => {
        const isActive = item.id === active;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={onPick}
              aria-current={isActive ? "true" : undefined}
              className={`flex min-h-11 items-start gap-2 rounded-field px-3 py-2 text-sm leading-snug transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest lg:min-h-9 lg:py-1.5 ${
                isActive ? "bg-forest-tint font-bold text-forest-700" : "font-medium text-ink-soft hover:bg-cream-2 hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="mt-px w-5 flex-none text-xs font-bold tabular-nums opacity-60">
                {n + 1}
              </span>
              <span>{item.label}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <details ref={details} className="group/toc rounded-card border-[1.5px] border-line bg-paper lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Icon name="toc" className="text-xl! text-forest-700" />
            En esta guía
          </span>
          <Icon name="expand_more" className="text-2xl! transition-transform duration-300 group-open/toc:rotate-180 motion-reduce:transition-none" />
        </summary>
        <nav aria-label="Índice de contenidos" className="border-t border-line p-2">
          {list(() => details.current?.removeAttribute("open"))}
        </nav>
      </details>
      <nav aria-label="Índice de contenidos" className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block">
        <p className="mb-2 px-3 text-xs font-bold text-ink-faint">En esta guía</p>
        {list()}
      </nav>
    </>
  );
}
