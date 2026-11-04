"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type AmenityIconItem = { name: string; icon: string; description: string };

/**
 * Fila de íconos de la tarjeta de residencia: una para «Servicios» (fondo crema) y otra para «Áreas comunes» (verde
 * suave), con su rótulo. Pasar el mouse, enfocar con teclado o tocar un ícono muestra qué es y qué incluye; Esc o tocar
 * afuera lo cierra. Los íconos son botones de 44 px (objetivo táctil), por eso la fila va FUERA del enlace de la
 * tarjeta. `extra` > 0 agrega un «+N» que lleva a la ficha. Las descripciones salen de `lib/residences/amenityIcons.ts`.
 */
export function AmenityIconRow({
  label,
  kind,
  items,
  extra = 0,
  extraNames = [],
  moreHref,
  moreLabel,
}: {
  label: string;
  kind: "service" | "area";
  items: AmenityIconItem[];
  extra?: number;
  /** Nombres de los que no entran en la fila: se listan al pasar el mouse (o enfocar) sobre el «+N». */
  extraNames?: string[];
  moreHref?: string;
  moreLabel?: string;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(null);
  // `pinned`: abierto por click/tap (no se cierra al sacar el mouse). El hover solo lo muestra de forma transitoria.
  const [pinned, setPinned] = useState(false);
  const [align, setAlign] = useState<"center" | "left" | "right">("center");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null);
        setPinned(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function show(i: number, el: HTMLElement) {
    // El tooltip mide ~220 px: si el ícono está cerca de un borde de la tarjeta, se alinea hacia adentro.
    const card = el.closest("[data-amenity-card]")?.getBoundingClientRect() ?? rootRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (card) setAlign(r.left - card.left < 110 ? "left" : card.right - r.right < 110 ? "right" : "center");
    setOpen(i);
  }

  if (items.length === 0) return null;
  const tone =
    kind === "area"
      ? "border-sage-100 bg-sage-50 text-sage-700 hover:border-sage-200 hover:bg-forest-tint hover:text-forest-700"
      : "border-line bg-cream text-ink-soft hover:border-sage-200 hover:bg-forest-tint hover:text-forest-700";

  return (
    <div ref={rootRef} className="grid gap-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
        {items.map((item, i) => {
          const id = `${baseId}-${i}`;
          const isOpen = open === i;
          return (
            <span
              key={item.name}
              className="relative min-w-8 max-w-11 flex-1 basis-9"
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                setPinned(false);
                show(i, e.currentTarget);
              }}
              onPointerLeave={(e) => e.pointerType === "mouse" && !pinned && setOpen((v) => (v === i ? null : v))}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(null);
                  setPinned(false);
                }
              }}
            >
              <button
                type="button"
                aria-label={item.name}
                aria-describedby={isOpen ? id : undefined}
                aria-expanded={isOpen}
                onClick={(e) => {
                  if (isOpen && pinned) {
                    setOpen(null);
                    setPinned(false);
                  } else {
                    show(i, e.currentTarget);
                    setPinned(true);
                  }
                }}
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && show(i, e.currentTarget)}
                onBlur={() => {
                  setOpen((v) => (v === i ? null : v));
                  setPinned(false);
                }}
                className={`flex h-11 w-full items-center justify-center rounded-[14px] border transition duration-200 ease-out-fresh hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest ${tone} ${isOpen ? "-translate-y-0.5 bg-forest-tint text-forest-700" : ""}`}
              >
                <Icon name={item.icon} className="text-2xl" />
              </button>
              {isOpen && (
                <span
                  id={id}
                  role="tooltip"
                  className={`absolute bottom-[calc(100%+10px)] z-20 w-[220px] rounded-[14px] bg-forest-ink px-3 py-2.5 text-left text-[13px] leading-snug text-white shadow-float ${
                    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  <span className="mb-0.5 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-soft-300">
                    {kind === "area" ? "Área común" : "Servicio"}
                  </span>
                  <b className="block text-[13.5px]">{item.name}</b>
                  {item.description !== item.name ? item.description : null}
                </span>
              )}
            </span>
          );
        })}
        {extra > 0 && moreHref && (
          <span className="group/tip relative shrink-0">
            <Link
              href={moreHref}
              aria-label={moreLabel ?? `Ver ${extra} más en la ficha`}
              className="flex h-11 items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-line-2 bg-paper px-2.5 text-[13px] font-bold text-forest-700 hover:bg-cream-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-forest"
            >
              +{extra}
            </Link>
            {extraNames.length > 0 && (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-20 hidden w-[220px] rounded-[14px] bg-forest-ink px-3 py-2.5 text-left text-[13px] leading-snug text-white shadow-float group-focus-within/tip:block group-hover/tip:block"
              >
                <span className="mb-0.5 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-soft-300">
                  {kind === "area" ? "Más áreas comunes" : "Más servicios"}
                </span>
                {extraNames.map((n) => (
                  <b key={n} className="block text-[13px] font-semibold">
                    {n}
                  </b>
                ))}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
