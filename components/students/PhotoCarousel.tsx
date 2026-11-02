"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { useSwipe } from "@/components/residences/useRotation";
import { ResidencePhotoPlaceholder } from "@/components/residences/ResidencePhoto";

/**
 * Carrusel simple para la hero card de "Mi residencia" en el Dashboard
 * (Ciclo 40, ref. Airbnb/Booking) — sin librería externa: una fila
 * `flex` con `translateX` animado y flechas/dots controlando el índice.
 * Loop circular para no dejar botones deshabilitados en los extremos.
 */
export function PhotoCarousel({ photos, alt, zone }: { photos: string[]; alt: string; zone?: string }) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const swipe = useSwipe((d) => setIndex((i) => (i + d + count) % Math.max(count, 1)));

  if (photos.length === 0)
    return (
      <div className="relative h-full w-full overflow-hidden">
        <ResidencePhotoPlaceholder name={alt} zone={zone} variant="hero" label="Fotos próximamente" />
      </div>
    );

  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length);

  return (
    <div {...(count > 1 ? swipe : {})} className={`group/carousel relative h-full w-full overflow-hidden ${count > 1 ? "touch-pan-y" : ""}`}>
      <div
        className="flex h-full transition-transform duration-500 ease-fresh"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {photos.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0">
            <Image
              src={src}
              alt={`${alt} — foto ${i + 1} de ${photos.length}`}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Foto anterior"
            className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 shadow-sm transition-opacity duration-300 ease-fresh hover:bg-paper focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest group-hover/carousel:opacity-100 max-sm:pointer-events-none max-sm:opacity-0 max-sm:focus-visible:pointer-events-auto max-sm:focus-visible:opacity-100"
          >
            <Icon name="chevron_left" className="text-xl" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(1);
            }}
            aria-label="Foto siguiente"
            className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 shadow-sm transition-opacity duration-300 ease-fresh hover:bg-paper focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest group-hover/carousel:opacity-100 max-sm:pointer-events-none max-sm:opacity-0 max-sm:focus-visible:pointer-events-auto max-sm:focus-visible:opacity-100"
          >
            <Icon name="chevron_right" className="text-xl" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {photos.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIndex(i);
                }}
                aria-label={`Ir a la foto ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all duration-300 ease-fresh ${
                  i === index ? "w-5 bg-paper" : "w-1.5 bg-paper/60 hover:bg-paper/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
