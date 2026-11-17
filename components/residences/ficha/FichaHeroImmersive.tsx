"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { usePhotoViewer } from "@/components/residences/PhotoViewer";
import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/brand/markPath";
import { pickHeroCover, photosButtonLabel } from "@/lib/residences/fichaHero";
import type { GalleryPhoto } from "@/lib/residences/photoMeta";

/**
 * Hero inmersivo de la ficha («placa porteña», propuesta A): la portada a pantalla completa (la primera de las fotos que rotan, el
 * mismo criterio de la imagen de vista previa del link), un velo para que lo que va encima se lea, la placa (`plate`, que lleva el
 * h1, el precio y el sello) y la CTA naranja (`cta`, solo escritorio).
 *
 * Conserva lo que hacía la galería anterior: el botón «Ver las N fotos» abre el visor agrupado por secciones con lightbox
 * (`usePhotoViewer`). Sin fotos muestra un fondo de marca (sin foto inventada) y sin botón; con una foto, solo esa.
 *
 * Layout: la placa y la CTA son hermanas de un mismo flex (escritorio) o apiladas (móvil); el sello vive dentro de la placa, en su
 * propio carril (ver `ResidencePlate`). Nada se superpone por posicionamiento absoluto salvo el botón de fotos (arriba a la derecha,
 * lejos de la placa, que va abajo).
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
      <section
        aria-label={`Portada de ${name}`}
        className="relative isolate flex min-h-[calc(100svh-4rem-4.75rem)] flex-col justify-end bg-forest-ink text-paper min-[768px]:min-h-[min(calc(100svh-4rem),780px)]"
      >
        {cover ? (
          <Image
            src={cover.url}
            alt={`Foto de ${name}${place}`}
            fill
            sizes="100vw"
            className="-z-20 object-cover"
            priority
          />
        ) : (
          <HeroPlaceholder />
        )}
        {/* Velo: oscurece de abajo hacia arriba para que la CTA y su aclaración se lean sobre cualquier foto. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [background:linear-gradient(to_top,var(--scrim-ink-70)_0%,var(--scrim-ink-70)_18%,transparent_62%)]"
        />

        {buttonLabel && (
          <div className="absolute inset-x-0 top-0 z-[1] mx-auto flex max-w-6xl justify-end px-4 pt-4 sm:px-6 sm:pt-6">
            <button
              type="button"
              onClick={() => viewer.openAt(0)}
              className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-[color:var(--paper-16)] bg-[color:var(--scrim-ink-70)] px-4 text-sm font-semibold text-paper transition-transform duration-200 ease-out-fresh motion-safe:active:scale-[0.97]"
            >
              <Icon name="photo_library" className="text-lg" />
              {buttonLabel}
            </button>
          </div>
        )}

        <div className="relative z-[1] mx-auto flex w-full max-w-6xl flex-col px-4 pb-5 pt-24 sm:px-6 sm:pb-10 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-6">
          {plate}
          {cta && <div className="hidden shrink-0 flex-col items-end gap-2.5 text-right min-[900px]:flex">{cta}</div>}
        </div>
      </section>
      {viewer.node}
    </>
  );
}

/** Fondo de marca cuando la residencia todavía no cargó fotos: el isotipo de EstuRed, grande y tenue, sobre forest. No es una foto ni la imita. */
function HeroPlaceholder() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-20 flex items-start justify-center overflow-hidden bg-forest-700">
      <svg
        viewBox={MARK_VIEWBOX}
        className="mt-10 h-[70%] w-auto max-w-none text-paper opacity-[0.07] min-[768px]:mt-6"
        focusable="false"
      >
        {MARK_PATHS.map((p) => (
          <path key={p.fill} d={p.d} fill="currentColor" fillRule="evenodd" />
        ))}
      </svg>
    </div>
  );
}
