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
 * Jerarquía visual: (1) la foto, (2) nombre y barrio, (3) precio «desde» con su ARS, (4) CTA «Elegir habitación», (5) botón de fotos,
 * (6) sello. Las tres primeras viven en la placa, chica y semitransparente; el sello es su carril propio (ver `ResidencePlate`).
 *
 * Layout: una sola fila al pie del hero. A la izquierda la «identidad» (el botón «Ver las N fotos» encima de la placa, alineados al
 * mismo borde) y a la derecha la CTA y su aclaración (desde 900 px; en móvil la acción vive en la barra inferior, así una sola CTA
 * late por pantalla). Todo en flujo normal: no hay nada `absolute` salvo la foto y el velo de fondo.
 *
 * El botón «Ver las N fotos» es el control de la galería: papel sólido, texto ink, 44 px de alto e ícono, para que se descubra a
 * simple vista sin competir con la CTA (naranja, más grande, la única que pulsa). Abre el visor agrupado por secciones con lightbox
 * (`usePhotoViewer`). Sin fotos muestra un fondo de marca (sin foto inventada) y sin botón; con una foto, solo esa.
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

        <div className="relative z-[1] mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-5 pt-16 sm:px-6 sm:pb-8 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-6">
          <div data-hero-region="identity" className="flex min-w-0 flex-col items-start gap-3 max-[899px]:w-full min-[900px]:max-w-[500px] min-[900px]:flex-1">
            {buttonLabel && (
              <button
                type="button"
                onClick={() => viewer.openAt(0)}
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-paper px-4 text-[15px] font-bold text-ink shadow-float transition-[background-color,transform] duration-200 ease-out-fresh hover:bg-cream-2 motion-safe:active:scale-[0.97]"
              >
                <Icon name="photo_library" className="text-xl text-forest-700" />
                {buttonLabel}
              </button>
            )}
            {plate}
          </div>
          {cta && (
            <div data-hero-region="cta" className="hidden shrink-0 flex-col items-end gap-2.5 text-right min-[900px]:flex">
              {cta}
            </div>
          )}
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
