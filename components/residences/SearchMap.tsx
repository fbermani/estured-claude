"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { MapTiles } from "@/components/residences/MapTiles";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { boundsCenterPixel, chooseZoom, latLngToWorldPixel, offsetFromCenter, tilesCovering, type PixelPoint } from "@/lib/maps/osmTiles";
import { UNIVERSITY_CATEGORIES, UNIVERSITY_PINS, type UniversityCategory } from "@/lib/maps/universityPins";
import type { MapPoint } from "@/lib/residences/mapPoints";

/**
 * Vista «Mapa» de /search (propuesta B): teselas de OpenStreetMap (mismo proveedor y mismo módulo que el mapa de la ficha,
 * sin API key ni librería de mapas) con un pin de precio por residencia. Encuadra todos los pines según el ancho real del
 * contenedor. Tocar un pin abre una mini-tarjeta con el enlace a la ficha; Esc o tocar el fondo la cierra. Recibe solo lo
 * mínimo de cada residencia (`MapPoint`). ⚠ Igual que `CompactMap`: antes del lanzamiento masivo hay que cambiar el
 * proveedor de teselas (ver `lib/maps/osmTiles.ts`). Además muestra siempre las universidades de CABA (pin de color según
 * categoría, con su nombre al tocarlas) y una referencia plegable con la lista agrupada por color.
 */
const PAD_X = 64;
const PAD_Y = 56;
const MIN_ZOOM = 10;
const MAX_ZOOM = 17;

type Cam = { key: string; zoom: number; c: PixelPoint };

export function SearchMap({ points, withoutLocation }: { points: MapPoint[]; withoutLocation: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openUni, setOpenUni] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState<boolean | null>(null);
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
    if (!openId && !openUni) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openId) pinRefs.current[openId]?.focus();
      setOpenId(null);
      setOpenUni(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, openUni]);

  const fitKey = points.map((p) => p.id).join("|");
  const fit = useMemo<Cam | null>(() => {
    if (!size) return null;
    // El encuadre incluye las universidades: siempre se ven todas, aunque no haya residencias con ubicación.
    const all = [...points, ...UNIVERSITY_PINS];
    const zoom = chooseZoom(all, Math.max(40, size.w / 2 - PAD_X), Math.max(40, size.h / 2 - PAD_Y), 11, 15);
    return { key: fitKey, zoom, c: boundsCenterPixel(all, zoom) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el encuadre inicial depende del conjunto de pines, no del redimensionado
  }, [!!size, fitKey]);
  const [userCam, setUserCam] = useState<Cam | null>(null);
  const cam = userCam && userCam.key === fitKey ? userCam : fit;
  const camRef = useRef(cam);
  camRef.current = cam;

  /** Zoom a `next` manteniendo fijo el punto bajo `anchor` (px desde el centro de la caja). */
  const zoomTo = (next: number, anchor: PixelPoint = { x: 0, y: 0 }) => {
    const cur = camRef.current;
    if (!cur) return;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (z === cur.zoom) return;
    const f = 2 ** (z - cur.zoom);
    setUserCam({ key: cur.key, zoom: z, c: { x: (cur.c.x + anchor.x) * f - anchor.x, y: (cur.c.y + anchor.y) * f - anchor.y } });
  };

  const anchorOf = (clientX: number, clientY: number): PixelPoint => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  // Rueda: zoom hacia el cursor (listener no pasivo para no scrollear la página).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 60) return;
      const dir = acc < 0 ? 1 : -1;
      acc = 0;
      if (camRef.current) zoomTo(camRef.current.zoom + dir, anchorOf(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // Arrastre (mouse, touch o lápiz). Un movimiento de más de 4 px no cuenta como click.
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const pointers = useRef(new Map<number, PixelPoint>());
  const pinch = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
      drag.current = null;
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (camRef.current && Math.abs(d - pinch.current) > 40) {
        zoomTo(camRef.current.zoom + (d > pinch.current ? 1 : -1), anchorOf((a.x + b.x) / 2, (a.y + b.y) / 2));
        pinch.current = d;
      }
      return;
    }
    const d = drag.current;
    const cur = camRef.current;
    if (!d || d.id !== e.pointerId || !cur) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) boxRef.current?.setPointerCapture(e.pointerId);
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setUserCam({ key: cur.key, zoom: cur.zoom, c: { x: cur.c.x - dx, y: cur.c.y - dy } });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    // `moved` se limpia después del click que sigue al soltar.
    setTimeout(() => {
      if (drag.current?.id === e.pointerId) drag.current = null;
    }, 0);
  };
  const wasDrag = () => !!drag.current?.moved;

  const view = useMemo(() => {
    if (!size || !cam) return null;
    return {
      tiles: tilesCovering(cam.c, cam.zoom, size.w / 2 + 128, size.h / 2 + 128),
      pins: points.map((p) => ({ p, pos: offsetFromCenter(p, cam.c, cam.zoom) })),
      unis: UNIVERSITY_PINS.map((u) => ({ u, pos: offsetFromCenter(u, cam.c, cam.zoom) })),
    };
  }, [size, cam, points]);

  const open = points.find((p) => p.id === openId) ?? null;
  const showLegend = legendOpen ?? false;
  /** Desde la referencia: abre el pin y centra el mapa en la universidad (acercando un poco si estaba muy lejos). */
  const focusUniversity = (name: string) => {
    const u = UNIVERSITY_PINS.find((x) => x.name === name);
    const cur = camRef.current;
    if (!u || !cur) return;
    const z = Math.max(cur.zoom, 14);
    setOpenId(null);
    setOpenUni(u.name);
    setUserCam({ key: cur.key, zoom: z, c: latLngToWorldPixel(u, z) });
  };
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
        onClick={() => {
          if (wasDrag()) return;
          setOpenId(null);
          setOpenUni(null);
        }}
        onDoubleClick={(e) => cam && zoomTo(cam.zoom + 1, anchorOf(e.clientX, e.clientY))}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-[520px] touch-none cursor-grab overflow-hidden active:cursor-grabbing rounded-card border-[1.5px] border-line bg-cream-2 shadow-card lg:h-[640px]"
      >
        {view && (
          <>
            <MapTiles tiles={view.tiles} unavailableMessage="El mapa no está disponible por ahora. Mirá las residencias en la vista Lista o Grilla." />
            <div className="absolute left-1/2 top-1/2 h-0 w-0">
              {view.unis.map(({ u, pos }) => {
                const isOpen = openUni === u.name;
                return (
                  <button
                    key={u.name}
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Universidad: ${u.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (wasDrag()) return;
                      setOpenId(null);
                      setOpenUni(isOpen ? null : u.name);
                    }}
                    style={{ left: pos.x, top: pos.y }}
                    className={`group/uni absolute ${isOpen ? "z-20" : "z-[11]"} flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-paper text-white shadow-[0_2px_6px_rgb(29_39_34/0.3)] hover:z-20 focus-visible:z-20 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest motion-safe:transition-transform hover:scale-110 ${UNIVERSITY_CATEGORIES[u.category].pin} ${isOpen ? "scale-110" : ""}`}
                  >
                    <Icon name="school" className="text-[15px]" />
                    <span
                      className={`pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-forest-ink px-2 py-1 text-xs font-semibold text-white shadow-card ${isOpen ? "block" : "hidden group-hover/uni:block group-focus-visible/uni:block"}`}
                    >
                      {isOpen ? u.name : u.short}
                    </span>
                  </button>
                );
              })}
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
                    if (wasDrag()) return;
                    setOpenId(openId === p.id ? null : p.id);
                  }}
                  style={{ left: pos.x, top: pos.y }}
                  className={`absolute z-10 min-h-8 -translate-x-1/2 -translate-y-full cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-1 text-[12.5px] font-bold shadow-[0_2px_8px_rgb(29_39_34/0.28)] motion-safe:transition-[transform,background-color,color] hover:z-20 hover:scale-110 focus-visible:z-20 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest after:absolute after:left-1/2 after:top-full after:size-[9px] after:-translate-x-1/2 after:-translate-y-0.5 after:rotate-45 after:border-b-[1.5px] after:border-r-[1.5px] after:border-inherit after:bg-inherit after:content-[''] ${
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
          <p className="pointer-events-none absolute inset-x-3 bottom-10 z-20 mx-auto max-w-md rounded-field bg-paper/95 p-3 text-center text-sm text-ink-soft shadow-card">
            Ninguna de estas residencias tiene ubicación cargada todavía. Probá la vista Lista o Grilla.
          </p>
        )}

        {cam && (
          <div
            className="absolute left-3 top-3 z-20 max-w-[calc(100%-5rem)]"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-expanded={showLegend}
              aria-controls="mapa-universidades"
              onClick={() => setLegendOpen(!showLegend)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line bg-paper px-3 text-[13px] font-bold text-ink shadow-card hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-forest"
            >
              <Icon name="school" className="text-lg text-petrol-600" />
              Universidades ({UNIVERSITY_PINS.length})
              <Icon name={showLegend ? "expand_more" : "expand_less"} className="text-lg" />
            </button>
            {!showLegend && (
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 rounded-field bg-paper/90 px-2.5 py-1.5 text-xs font-semibold text-ink shadow-card">
                {(Object.keys(UNIVERSITY_CATEGORIES) as UniversityCategory[]).map((cat) => (
                  <li key={cat} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={`size-3 rounded-full ${UNIVERSITY_CATEGORIES[cat].dot}`} />
                    {UNIVERSITY_CATEGORIES[cat].label}
                  </li>
                ))}
              </ul>
            )}
            {showLegend && (
              <div id="mapa-universidades" className="mt-2 max-h-56 w-72 max-w-full overflow-y-auto rounded-2xl border-[1.5px] border-line bg-paper p-3 shadow-float sm:max-h-72">
                {(Object.keys(UNIVERSITY_CATEGORIES) as UniversityCategory[]).map((cat) => (
                  <section key={cat} aria-label={UNIVERSITY_CATEGORIES[cat].label} className="mb-2 last:mb-0">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink-faint">
                      <span aria-hidden="true" className={`size-3 rounded-full ${UNIVERSITY_CATEGORIES[cat].dot}`} />
                      {UNIVERSITY_CATEGORIES[cat].label}
                    </h3>
                    <ul className="mt-1">
                      {UNIVERSITY_PINS.filter((u) => u.category === cat).map((u) => (
                        <li key={u.name}>
                          <button
                            type="button"
                            onClick={() => focusUniversity(u.name)}
                            className={`min-h-8 w-full cursor-pointer rounded-md px-2 text-left text-[13px] text-ink hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-forest ${openUni === u.name ? "bg-cream-2 font-bold" : ""}`}
                          >
                            {u.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {open && (
          <div
            role="dialog"
            aria-label={open.name}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-x-3 bottom-3 z-30 overflow-hidden rounded-2xl bg-paper shadow-float sm:inset-x-auto sm:left-4 sm:w-80"
          >
            <div className="relative h-32 w-full bg-cream-2">
              <ResidencePhoto src={open.photo} name={open.name} zone={open.zone} sizes="320px" />
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => {
                  pinRefs.current[open.id]?.focus();
                  setOpenId(null);
                }}
                className="absolute right-2 top-2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-paper/95 text-ink-soft shadow-card hover:bg-paper focus-visible:outline-2 focus-visible:outline-forest"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
            <div className="p-3 pl-4">
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
          </div>
        )}

        {cam && (
          <div className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-field border-[1.5px] border-line bg-paper shadow-card" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Acercar" disabled={cam.zoom >= MAX_ZOOM} onClick={() => zoomTo(cam.zoom + 1)} className="flex size-10 cursor-pointer items-center justify-center text-xl font-bold text-ink hover:bg-cream-2 disabled:cursor-default disabled:text-ink-faint focus-visible:outline-2 focus-visible:outline-forest">
              +
            </button>
            <button type="button" aria-label="Alejar" disabled={cam.zoom <= MIN_ZOOM} onClick={() => zoomTo(cam.zoom - 1)} className="flex size-10 cursor-pointer items-center justify-center border-t-[1.5px] border-line text-xl font-bold text-ink hover:bg-cream-2 disabled:cursor-default disabled:text-ink-faint focus-visible:outline-2 focus-visible:outline-forest">
              −
            </button>
          </div>
        )}

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-1.5 z-20 rounded bg-paper/85 px-1.5 py-0.5 text-xs text-ink-soft hover:underline"
        >
          © colaboradores de OpenStreetMap
        </a>
      </div>
    </div>
  );
}
