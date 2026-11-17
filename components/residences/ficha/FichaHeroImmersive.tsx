"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { usePhotoViewer } from "@/components/residences/PhotoViewer";
import { BrandBackdrop } from "@/components/residences/ficha/BrandBackdrop";
import { pickHeroCover, photosButtonLabel } from "@/lib/residences/fichaHero";
import type { GalleryPhoto } from "@/lib/residences/photoMeta";

/**
 * Hero de la ficha («placa porteña», propuesta A): un MARCO verde de marca (forest-ink) con la portada como pieza adentro, como en el
 * mockup aprobado. La portada es la primera de las fotos que rotan (el mismo criterio de la imagen de vista previa del link); sin
 * fotos entra la ilustración de marca (`BrandBackdrop`), sin foto inventada. Sobre la pieza van un velo para que lo de abajo se lea,
 * la placa (`plate`, que lleva el h1, la dirección, el precio y el sello) y la CTA naranja (`cta`, solo escritorio).
 *
 * Jerarquía visual: (1) la foto dentro del marco verde, (2) nombre, dirección y barrio, (3) precio «desde» con su ARS, (4) CTA «Elegir
 * habitación», (5) botón de fotos, (6) sello. Las tres primeras viven en la placa, chica y semitransparente; el sello es su carril propio
 * (ver `ResidencePlate`).
 *
 * Layout: el marco es el padding verde de la sección (12 px en móvil, 24 px desde `sm`); la pieza es una tarjeta con esquinas
 * `rounded-card`. Al pie de la pieza, una sola fila en flujo normal: la placa a la izquierda y la CTA con su aclaración a la derecha
 * (desde 900 px; en móvil la acción vive en la barra inferior, así una sola CTA late por pantalla). El botón «Ver las N fotos» va arriba
 * a la derecha de la pieza, como en el mockup, lejos de la placa: así nada compite con el precio.
 *
 * El botón «Ver las N fotos» es el control de la galería: papel sólido, texto ink, 44 px de alto e ícono, para que se descubra a simple
 * vista sin competir con la CTA (naranja, más grande, la única que pulsa). Abre el visor agrupado por secciones con lightbox
 * (`usePhotoViewer`). Con una foto, solo esa; con ninguna, sin botón.
 */
export function FichaHeroImmersive({
  photos,
  name,
  zone,
  plate,
  cta,
}: {
  photos: GalleryPhoto[];
  name: string;
  zone: string;
  /** `ResidencePlate variant="hero"` (server). */
  plate: ReactNode;
  /** CTA y su aclaración, ya armadas (visibles desde 900 px). */
  cta?: ReactNode;
}) {
  const viewer = usePhotoViewer({ photos, name, zone });
  const cover = pickHeroCover(photos);
  const buttonLabel = photosButtonLabel(photos.length);
  const place = zone ? ` en ${zone}` : "";

  return (
    <>
      <section aria-label={`Portada de ${name}`} className="bg-forest-ink px-3 pb-3 pt-3 text-paper sm:px-6 sm:pb-6 sm:pt-4">
        <div
          data-hero-frame
          className="relative isolate mx-auto flex min-h-[calc(100svh-4rem-4.75rem-1.5rem)] max-w-[1400px] flex-col justify-end overflow-hidden rounded-card bg-forest-700 min-[768px]:min-h-[min(calc(100svh-4rem-3rem),760px)]"
        >
          {cover ? (
            <Image
              src={cover.url}
              alt={`Foto de ${name}${place}`}
              fill
              sizes="(max-width: 1400px) 100vw, 1400px"
              className="-z-20 object-cover"
              priority
            />
          ) : (
            <BrandBackdrop className="-z-20" />
          )}
          {/* Velo: oscurece de abajo hacia arriba para que la CTA y su aclaración se lean sobre cualquier foto. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 [background:linear-gradient(to_top,var(--scrim-ink-70)_0%,var(--scrim-ink-70)_18%,transparent_62%)]"
          />

          {buttonLabel && (
            <button
              type="button"
              onClick={() => viewer.openAt(0)}
              className="absolute right-3 top-3 z-[2] inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-paper px-4 text-[15px] font-bold text-ink shadow-float transition-[background-color,transform] duration-200 ease-out-fresh hover:bg-cream-2 motion-safe:active:scale-[0.97] sm:right-5 sm:top-5"
            >
              <Icon name="photo_library" className="text-xl text-forest-700" />
              {buttonLabel}
            </button>
          )}

          <div className="relative z-[1] flex w-full flex-col gap-3 px-3 pb-3 pt-20 sm:px-6 sm:pb-6 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-6">
            <div data-hero-region="identity" className="flex min-w-0 flex-col items-start max-[899px]:w-full min-[900px]:max-w-[500px] min-[900px]:flex-1">
              {plate}
            </div>
            {cta && (
              <div data-hero-region="cta" className="hidden shrink-0 flex-col items-end gap-2.5 text-right min-[900px]:flex">
                {cta}
              </div>
            )}
          </div>
        </div>
      </section>
      {viewer.node}
    </>
  );
}
