"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import type { GalleryLayout } from "@/lib/residences/photos";
import { pickRotationPhotos, type GalleryPhoto } from "@/lib/residences/photoMeta";
import { useRotation, useSwipe } from "@/components/residences/useRotation";
import { usePhotoViewer } from "@/components/residences/PhotoViewer";

/**
 * Mosaico de fotos de la ficha (2+ fotos) con el visor de todas las fotos (`usePhotoViewer`: `<dialog>` nativo agrupado por secciones y
 * lightbox con flechas, teclado y deslizar). En mobile se ve una sola foto grande con el botón "Ver N fotos"; desde `sm` aparece el mosaico.
 * El hero inmersivo de la ficha («placa porteña») usa el mismo visor; este mosaico queda para el capítulo «Vivir acá».
 */

// Clases por posición según la cantidad de fotos del mosaico (literales para que Tailwind las detecte).
const TILE_SPANS: Record<number, string[]> = {
  2: ["sm:col-span-2 sm:row-span-2", "sm:col-span-2 sm:row-span-2"],
  3: ["sm:col-span-2 sm:row-span-2", "sm:col-span-2", "sm:col-span-2"],
  4: ["sm:col-span-2 sm:row-span-2", "sm:col-span-2", "sm:col-span-1", "sm:col-span-1"],
  5: [
    "sm:col-span-2 sm:row-span-2",
    "sm:col-span-1",
    "sm:col-span-1",
    "sm:col-span-1",
    "sm:col-span-1",
  ],
};

export function GalleryMosaic({
  photos,
  name,
  zone,
  layout,
}: {
  photos: GalleryPhoto[];
  name: string;
  zone: string;
  layout: Exclude<GalleryLayout, "empty" | "single">;
}) {
  const viewer = usePhotoViewer({ photos, name, zone });
  const { ordered, dialogOpen, total, place } = viewer;
  // DR18: el hero rota las destacadas (hasta 5); si hay menos de 5, los tiles se completan con el resto de la galería.
  const rotation = pickRotationPhotos(photos);
  const [paused, setPaused] = useState(false);
  // La rotación se pausa con hover/foco y mientras el visor está abierto.
  const { index: heroIndex, go: heroGo, ref: heroRef, playing: heroPlaying, toggle: heroToggle } = useRotation(rotation.length, { paused: paused || dialogOpen });
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [lastHero, setLastHero] = useState(0);
  if (heroIndex !== lastHero) {
    setLastHero(heroIndex);
    if (!seen.has(heroIndex)) setSeen(new Set(seen).add(heroIndex));
  }
  const rotates = rotation.length > 1;
  const swipe = useSwipe(heroGo);
  // La foto activa del hero no se repite en los tiles vecinos: estos se arman con el resto (destacadas primero, luego las demás).
  const activeHero = rotation[heroIndex] ?? photos[0];
  const neighbors = [...rotation, ...photos.filter((p) => !rotation.includes(p))].filter((p) => p !== activeHero);
  const visible = [activeHero, ...neighbors].slice(0, Math.min(total, 5));
  const spans = TILE_SPANS[visible.length] ?? TILE_SPANS[5];
  const showAll = layout === "mosaic-more";

  return (
    <>
      <div
        ref={heroRef}
        {...(rotates ? swipe : {})}
        role="group"
        aria-roledescription={rotates ? "carrusel" : undefined}
        aria-label={rotates ? `Fotos destacadas de ${name}` : undefined}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
        }}
        className={`relative ${rotates ? "touch-pan-y" : ""}`}
      >
        <div className="grid h-72 grid-cols-1 gap-2 overflow-hidden rounded-card sm:h-[440px] sm:grid-cols-4 lg:h-[500px] sm:grid-rows-2">
          {visible.map((photo, i) => {
            const isLastTile = showAll && i === visible.length - 1;
            const isHero = i === 0 && rotates;
            const heroPhoto = photo;
            return (
              <button
                key={i === 0 ? "hero" : photo.url}
                type="button"
                onClick={() => viewer.openPhoto(isLastTile ? ordered[0] : heroPhoto)}
                aria-label={isLastTile ? `Ver todas las fotos (${total})` : `Ver foto ${ordered.indexOf(heroPhoto) + 1} de ${total}`}
                className={`relative overflow-hidden bg-sand-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest ${
                  i === 0 ? "" : "hidden sm:block"
                } ${spans[i]}`}
              >
                {isHero ? (
                  rotation.map((r, k) =>
                    seen.has(k) ? (
                      <Image
                        key={r.url}
                        src={r.url}
                        alt={k === heroIndex ? `Foto de ${name}${place}` : ""}
                        aria-hidden={k === heroIndex ? undefined : true}
                        fill
                        sizes="(max-width: 640px) 100vw, 576px"
                        className={`object-cover transition-opacity duration-700 motion-reduce:transition-none ${k === heroIndex ? "opacity-100" : "opacity-0"}`}
                        priority={k === 0}
                      />
                    ) : null,
                  )
                ) : (
                  <Image
                    src={photo.url}
                    alt={`Foto ${ordered.indexOf(photo) + 1} de ${total} de ${name}${place}`}
                    fill
                    sizes={i === 0 || visible.length === 2 ? "(max-width: 640px) 100vw, 576px" : "288px"}
                    className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                    priority={i === 0}
                  />
                )}
                {isLastTile && (
                  <span className="absolute inset-0 flex items-center justify-center bg-forest-ink/55 px-2 text-center text-sm font-bold text-white sm:text-base">
                    Ver todas ({total})
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {rotates && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-paper/95 p-1 text-ink shadow-card">
            <button
              type="button"
              onClick={() => heroGo(-1)}
              aria-label="Foto destacada anterior"
              className="flex size-11 items-center justify-center rounded-full hover:bg-forest-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest max-sm:pointer-events-none max-sm:opacity-0 max-sm:focus-visible:pointer-events-auto max-sm:focus-visible:opacity-100"
            >
              <Icon name="chevron_left" className="text-xl" />
            </button>
            <span className="min-w-10 text-center text-xs font-bold tabular-nums" aria-hidden>
              {heroIndex + 1} / {rotation.length}
            </span>
            <button
              type="button"
              onClick={() => heroGo(1)}
              aria-label="Foto destacada siguiente"
              className="flex size-11 items-center justify-center rounded-full hover:bg-forest-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest max-sm:pointer-events-none max-sm:opacity-0 max-sm:focus-visible:pointer-events-auto max-sm:focus-visible:opacity-100"
            >
              <Icon name="chevron_right" className="text-xl" />
            </button>
            <button
              type="button"
              onClick={heroToggle}
              aria-label={heroPlaying ? "Pausar fotos destacadas" : "Reproducir fotos destacadas"}
              className="flex size-11 items-center justify-center rounded-full hover:bg-forest-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
            >
              <Icon name={heroPlaying ? "pause" : "play_arrow"} className="text-xl" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => viewer.openAt(0)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-paper/95 px-3.5 py-2 text-sm font-bold text-ink shadow-card transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest sm:hidden"
        >
          <Icon name="photo_library" className="text-lg" />
          Ver {total} fotos
        </button>
      </div>

      {viewer.node}
    </>
  );
}
