"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import type { GalleryLayout } from "@/lib/residences/photos";
import { groupGalleryPhotos, pickRotationPhotos, type GalleryPhoto } from "@/lib/residences/photoMeta";
import { useRotation } from "@/components/residences/useRotation";

/**
 * Mosaico del hero de la ficha (2+ fotos) con visor de todas las fotos en
 * un `<dialog>` nativo (foco y Escape los resuelve el navegador; el scroll
 * del body se bloquea a mano mientras está abierto, porque `showModal()` no lo hace). En mobile se ve una sola foto grande con el botón "Ver N
 * fotos"; desde `sm` aparece el mosaico.
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyOverflowRef = useRef<string | null>(null);

  function lockScroll() {
    if (bodyOverflowRef.current === null) bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  function unlockScroll() {
    if (bodyOverflowRef.current === null) return;
    document.body.style.overflow = bodyOverflowRef.current;
    bodyOverflowRef.current = null;
  }
  // Si el componente se desmonta con el visor abierto, no dejar la página sin scroll.
  useEffect(() => unlockScroll, []);
  const total = photos.length;
  const place = zone ? ` en ${zone}` : "";
  // DR18: el hero rota las destacadas (hasta 5); si hay menos de 5, los tiles se completan con el resto de la galería.
  const rotation = pickRotationPhotos(photos);
  // Orden del visor: agrupado por General / área / tipo de habitación.
  const groups = groupGalleryPhotos(photos);
  const ordered = groups.flatMap((g) => g.photos);
  const [paused, setPaused] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // La rotación se pausa con hover/foco y mientras el visor está abierto.
  const { index: heroIndex, go: heroGo, ref: heroRef } = useRotation(rotation.length, { paused: paused || dialogOpen });
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [lastHero, setLastHero] = useState(0);
  if (heroIndex !== lastHero) {
    setLastHero(heroIndex);
    if (!seen.has(heroIndex)) setSeen(new Set(seen).add(heroIndex));
  }
  const rotates = rotation.length > 1;
  // La foto activa del hero no se repite en los tiles vecinos: estos se arman con el resto (destacadas primero, luego las demás).
  const activeHero = rotation[heroIndex] ?? photos[0];
  const neighbors = [...rotation, ...photos.filter((p) => !rotation.includes(p))].filter((p) => p !== activeHero);
  const visible = [activeHero, ...neighbors].slice(0, Math.min(total, 5));
  const spans = TILE_SPANS[visible.length] ?? TILE_SPANS[5];
  const showAll = layout === "mosaic-more";

  function openPhoto(photo: GalleryPhoto) {
    openAt(Math.max(0, ordered.indexOf(photo)));
  }

  function openAt(index: number) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      lockScroll();
      setDialogOpen(true);
      dialog.showModal();
    }
    // Espera un frame para que el diálogo ya tenga layout antes de desplazar.
    requestAnimationFrame(() => {
      dialog.querySelector<HTMLElement>(`[data-photo-index="${index}"]`)?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <>
      <div
        ref={heroRef}
        role="group"
        aria-roledescription={rotates ? "carrusel" : undefined}
        aria-label={rotates ? `Fotos destacadas de ${name}` : undefined}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
        }}
        className="relative"
      >
        <div className="grid h-72 grid-cols-1 gap-2 overflow-hidden rounded-card sm:h-[420px] sm:grid-cols-4 sm:grid-rows-2">
          {visible.map((photo, i) => {
            const isLastTile = showAll && i === visible.length - 1;
            const isHero = i === 0 && rotates;
            const heroPhoto = photo;
            return (
              <button
                key={i === 0 ? "hero" : photo.url}
                type="button"
                onClick={() => openPhoto(isLastTile ? ordered[0] : heroPhoto)}
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
              className="flex size-8 items-center justify-center rounded-full hover:bg-forest-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
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
              className="flex size-8 items-center justify-center rounded-full hover:bg-forest-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
            >
              <Icon name="chevron_right" className="text-xl" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => openAt(0)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-paper/95 px-3.5 py-2 text-sm font-bold text-ink shadow-card transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest sm:hidden"
        >
          <Icon name="photo_library" className="text-lg" />
          Ver {total} fotos
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={`Fotos de ${name}`}
        onClose={() => {
          unlockScroll();
          setDialogOpen(false);
        }}
        onClick={(e) => {
          // Click en el fondo (el propio <dialog>, fuera del contenido) cierra.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[92vh] w-[min(960px,94vw)] overflow-hidden rounded-card bg-cream p-0 shadow-float backdrop:bg-forest-ink/70"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
          <p className="truncate text-sm font-bold text-ink">
            {name} · {total} fotos
          </p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-forest-700 hover:bg-forest-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
          >
            <Icon name="close" className="text-lg" />
            Cerrar
          </button>
        </div>
        <div className="max-h-[calc(92vh-56px)] space-y-5 overflow-y-auto p-3 sm:p-4">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.title} className="space-y-3">
              {groups.length > 1 && <h3 className="text-sm font-bold text-ink">{group.title}</h3>}
              {group.photos.map((photo) => {
                const i = ordered.indexOf(photo);
                return (
                  <div
                    key={photo.url}
                    data-photo-index={i}
                    className="relative aspect-[4/3] w-full scroll-mt-2 overflow-hidden rounded-field bg-sand-200"
                  >
                    <Image
                      src={photo.url}
                      alt={`${group.title}: foto ${i + 1} de ${total} de ${name}${place}`}
                      fill
                      sizes="(max-width: 1024px) 94vw, 920px"
                      className="object-cover"
                    />
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
