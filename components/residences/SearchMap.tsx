"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { MapTiles } from "@/components/residences/MapTiles";
import { boundsCenterPixel, chooseZoom, offsetFromCenter, tilesCovering } from "@/lib/maps/osmTiles";
import type { MapPoint } from "@/lib/residences/mapPoints";

/**
 * Vista «Mapa» de /search (propuesta B): teselas de OpenStreetMap (mismo proveedor y mismo módulo que el mapa de la ficha,
 * sin API key ni librería de mapas) con un pin de precio por residencia. Encuadra todos los pines según el ancho real del
 * contenedor. Tocar un pin abre una mini-tarjeta con el enlace a la ficha; Esc o tocar el fondo la cierra. Recibe solo lo
 * mínimo de cada residencia (`MapPoint`). ⚠ Igual que `CompactMap`: antes del lanzamiento masivo hay que cambiar el
 * proveedor de teselas (ver `lib/maps/osmTiles.ts`).
 */
const PAD_X = 64;
const PAD_Y = 56;

export function SearchMap({ points, withoutLocation }: { points: MapPoint[]; withoutLocation: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const pinRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      pinRefs.current[openId]?.focus();
      setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

  const view = useMemo(() => {
    if (!size || points.length === 0) return null;
    const zoom = chooseZoom(points, Math.max(40, size.w / 2 - PAD_X), Math.max(40, size.h / 2 - PAD_Y), 11, 15);
    const center = boundsCenterPixel(points, zoom);
    return {
      tiles: tilesCovering(center, zoom, size.w / 2 + 128, size.h / 2 + 128),
      pins: points.map((p) => ({ p, pos: offsetFromCenter(p, center, zoom) })),
    };
  }, [size, points]);

  const open = points.find((p) => p.id === openId) ?? null;
  // El pin abierto va arriba de los demás.
  const pins = view ? [...view.pins].sort((a, b) => (a.p.id === openId ? 1 : 0) - (b.p.id === openId ? 1 : 0)) : [];

  return (
    <div>
      {withoutLocation > 0 && (
        <p className="mb-2 flex items-center gap-1.5 text-[13px] text-ink-faint">
          <Icon name="info" className="text-base" />
          {withoutLocation} {withoutLocation === 1 ? "residencia sin ubicación no aparece" : "residencias sin ubicación no aparecen"} en el mapa. Las ves en la vista Lista o Grilla.
        </p>
      )}
      <div
        ref={boxRef}
        role="group"
        aria-label="Mapa de residencias con el precio desde de cada una"
        onClick={() => setOpenId(null)}
        className="relative h-[520px] overflow-hidden rounded-card border-[1.5px] border-line bg-cream-2 shadow-card lg:h-[640px]"
      >
        {view && (
          <>
            <MapTiles tiles={view.tiles} unavailableMessage="El mapa no está disponible por ahora. Mirá las residencias en la vista Lista o Grilla." />
            <div className="absolute left-1/2 top-1/2 h-0 w-0">
              {pins.map(({ p, pos }) => (
                <button
                  key={p.id}
                  ref={(el) => {
                    pinRefs.current[p.id] = el;
                  }}
                  type="button"
                  aria-expanded={openId === p.id}
                  aria-label={`${p.name}, desde USD ${p.price} por mes`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenId(openId === p.id ? null : p.id);
                  }}
                  style={{ left: pos.x, top: pos.y }}
                  className={`absolute z-10 min-h-8 -translate-x-1/2 -translate-y-full cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-1 text-[12.5px] font-bold shadow-[0_2px_8px_rgb(29_39_34/0.28)] motion-safe:transition-[transform,background-color,color] hover:z-20 hover:scale-110 focus-visible:z-20 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest after:absolute after:left-1/2 after:top-full after:size-[9px] after:-translate-x-1/2 after:-translate-y-[3px] after:rotate-45 after:border-b-[1.5px] after:border-r-[1.5px] after:border-inherit after:bg-inherit after:content-[''] ${
                    openId === p.id ? "z-20 scale-110 border-forest bg-forest text-white" : "border-paper bg-paper text-ink hover:border-forest hover:bg-forest hover:text-white"
                  }`}
                >
                  USD {p.price}
                </button>
              ))}
            </div>
          </>
        )}

        {points.length === 0 && (
          <p className="absolute inset-0 z-20 grid place-items-center bg-cream/70 p-6 text-center text-sm text-ink-soft">
            Ninguna de estas residencias tiene ubicación cargada todavía. Probá la vista Lista o Grilla.
          </p>
        )}

        {open && (
          <div
            role="dialog"
            aria-label={open.name}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl bg-paper p-3 pl-4 shadow-float sm:inset-x-auto sm:left-4 sm:w-96"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] font-bold text-ink">{open.name}</p>
              <p className="text-[13px] text-ink-soft">{open.zone}, CABA</p>
              <p className="mt-0.5 text-sm text-ink">
                <b>desde USD {open.price}</b>
                <span className="text-ink-faint"> /mes</span>
              </p>
              <Link
                href={`/residencias/${open.slug}`}
                className="mt-2 inline-flex min-h-9 items-center rounded-full bg-forest px-4 text-[13px] font-bold text-white hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                Ver residencia
              </Link>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => {
                pinRefs.current[open.id]?.focus();
                setOpenId(null);
              }}
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center self-start rounded-full text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-forest"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
        )}

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-1.5 z-20 rounded bg-paper/85 px-1.5 py-0.5 text-[10px] text-ink-soft hover:underline"
        >
          © colaboradores de OpenStreetMap
        </a>
      </div>
    </div>
  );
}
