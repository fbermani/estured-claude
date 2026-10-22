"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import type { GalleryLayout } from "@/lib/residences/photos";

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
  photos: string[];
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
  const visible = photos.slice(0, Math.min(total, 5));
  const spans = TILE_SPANS[visible.length] ?? TILE_SPANS[5];
  const showAll = layout === "mosaic-more";

  function openAt(index: number) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      lockScroll();
      dialog.showModal();
    }
    // Espera un frame para que el diálogo ya tenga layout antes de desplazar.
    requestAnimationFrame(() => {
      dialog.querySelector<HTMLElement>(`[data-photo-index="${index}"]`)?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <>
      <div className="relative">
        <div className="grid h-72 grid-cols-1 gap-2 overflow-hidden rounded-card sm:h-[420px] sm:grid-cols-4 sm:grid-rows-2">
          {visible.map((url, i) => {
            const isLastTile = showAll && i === visible.length - 1;
            return (
              <button
                key={url}
                type="button"
                onClick={() => openAt(isLastTile ? 0 : i)}
                aria-label={isLastTile ? `Ver todas las fotos (${total})` : `Ver foto ${i + 1} de ${total}`}
                className={`relative overflow-hidden bg-sand-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest ${
                  i === 0 ? "" : "hidden sm:block"
                } ${spans[i]}`}
              >
                <Image
                  src={url}
                  alt={`Foto ${i + 1} de ${total} de ${name}${place}`}
                  fill
                  sizes={i === 0 || visible.length === 2 ? "(max-width: 640px) 100vw, 576px" : "288px"}
                  className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                  priority={i === 0}
                />
                {isLastTile && (
                  <span className="absolute inset-0 flex items-center justify-center bg-forest-ink/55 px-2 text-center text-sm font-bold text-white sm:text-base">
                    Ver todas ({total})
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
        onClose={unlockScroll}
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
        <div className="max-h-[calc(92vh-56px)] space-y-3 overflow-y-auto p-3 sm:p-4">
          {photos.map((url, i) => (
            <div
              key={url}
              data-photo-index={i}
              className="relative aspect-[4/3] w-full scroll-mt-2 overflow-hidden rounded-field bg-sand-200"
            >
              <Image
                src={url}
                alt={`Foto ${i + 1} de ${total} de ${name}${place}`}
                fill
                sizes="(max-width: 1024px) 94vw, 920px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}
