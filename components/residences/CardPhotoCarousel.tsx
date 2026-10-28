"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { useRotation } from "@/components/residences/useRotation";

/**
 * Foto de la tarjeta del catálogo (DR18, tanda 2): con 2+ fotos rota sola y se puede pasar con flechas.
 * La foto es un enlace a la ficha (overlay) y los controles son botones aparte: no hay interactivos anidados dentro de un <a>.
 * Se pausa con hover o foco; respeta `prefers-reduced-motion` (ver `useRotation`). Los badges llegan como `children`.
 */
export function CardPhotoCarousel({
  photos,
  name,
  zone,
  href,
  sizes,
  children,
}: {
  photos: string[];
  name: string;
  zone: string;
  href: string;
  sizes: string;
  children?: ReactNode;
}) {
  const [paused, setPaused] = useState(false);
  const { index, go, setIndex, ref } = useRotation(photos.length, { paused });
  // Solo se montan las fotos ya vistas: crossfade sin bajar las 5 de entrada.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [lastIndex, setLastIndex] = useState(0);
  if (index !== lastIndex) {
    setLastIndex(index);
    if (!seen.has(index)) setSeen(new Set(seen).add(index));
  }
  const multiple = photos.length > 1;

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription={multiple ? "carrusel" : undefined}
      aria-label={multiple ? `Fotos de ${name}` : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className="group/photo relative h-48 w-full overflow-hidden bg-sand-200"
    >
      {photos.length === 0 ? (
        <ResidencePhoto src={null} name={name} zone={zone} sizes={sizes} label="Foto próximamente" />
      ) : (
        photos.map((src, i) =>
          seen.has(i) ? (
            <Image
              key={src}
              src={src}
              alt={i === index ? `Foto ${i + 1} de ${photos.length} de ${name}${zone ? ` en ${zone}` : ""}` : ""}
              aria-hidden={i === index ? undefined : true}
              fill
              sizes={sizes}
              className={`object-cover transition-opacity duration-700 motion-reduce:transition-none ${i === index ? "opacity-100" : "opacity-0"}`}
            />
          ) : null,
        )
      )}

      <Link href={href} tabIndex={-1} aria-label={`Ver ${name}`} className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest" />

      <div className="pointer-events-none absolute inset-0 z-20">{children}</div>

      {multiple && (
        <>
          {(
            [
              { delta: -1, icon: "chevron_left", label: "Foto anterior", side: "left-2" },
              { delta: 1, icon: "chevron_right", label: "Foto siguiente", side: "right-2" },
            ] as const
          ).map((b) => (
            <button
              key={b.delta}
              type="button"
              onClick={() => go(b.delta)}
              aria-label={`${b.label} de ${name}`}
              className={`absolute top-1/2 z-30 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink shadow-card transition-opacity hover:bg-paper focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest [@media(hover:hover)]:opacity-0 group-hover/photo:opacity-100 ${b.side}`}
            >
              <Icon name={b.icon} className="text-xl" />
            </button>
          ))}
          <div className="absolute bottom-1.5 right-2 z-30 flex items-center rounded-full bg-forest-ink/45 px-0.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver foto ${i + 1} de ${photos.length}`}
                aria-current={i === index ? "true" : undefined}
                className="group/dot flex size-6 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <span className={`size-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/50"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
