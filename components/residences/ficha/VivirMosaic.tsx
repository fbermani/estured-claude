"use client";

import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { usePhotoViewer } from "@/components/residences/PhotoViewer";
import { BrandBackdrop } from "@/components/residences/ficha/BrandBackdrop";
import { allPhotosLabel, buildMosaicSlots, EMPTY_BIG_LABEL, EMPTY_SMALL_LABEL, emptyMosaicNote } from "@/lib/residences/fichaMosaic";
import type { GalleryPhoto } from "@/lib/residences/photoMeta";

/**
 * Mosaico del capítulo «Vivir acá» (propuesta A, mockup aprobado): una foto grande a la izquierda y dos chicas a la derecha, cada una con su
 * rótulo («Patio con parrilla», «Cocina») y la última con «+ N fotos». Cada tarjeta abre el visor en esa foto (`usePhotoViewer`, el mismo
 * visor agrupado por secciones del hero); la última lo abre desde el principio. Alto fijo de 240 px (2 × 116 + 8, como el mockup). Debajo, el pill «Ver todas las fotos (N)» (44 px).
 * Con menos de 2 fotos el mosaico se dibuja igual y las tarjetas que faltan quedan vacías: fondo de marca (`BrandBackdrop`), ícono y rótulo
 * «Próximamente». Las vacías no son botones ni abren el visor; un solo texto para lectores explica que no hay fotos. Con 0 fotos tampoco hay
 * pill. Las imágenes cargan perezosas: están bajo el pliegue.
 */
export function VivirMosaic({ photos, name, zone }: { photos: GalleryPhoto[]; name: string; zone: string }) {
  const viewer = usePhotoViewer({ photos, name, zone });
  const slots = buildMosaicSlots(photos);
  const hasEmpty = slots.some((s) => s.kind === "empty");
  const place = zone ? ` en ${zone}` : "";
  const two = slots.length === 2;

  return (
    <>
      <ul
        className={`grid h-60 list-none gap-2 p-0 ${two ? "grid-cols-2" : "grid-cols-[2fr_1fr] grid-rows-2"}`}
        {...(photos.length === 0 ? { "aria-hidden": true } : { "aria-label": "Fotos de la residencia" })}
      >
        {slots.map((slot, i) => {
          const big = !two && i === 0;
          const cell = `min-h-0 ${big ? "row-span-2" : ""}`;
          if (slot.kind === "empty") {
            return (
              <li key={`empty-${i}`} aria-hidden="true" className={cell}>
                <div className="relative size-full overflow-hidden rounded-field bg-forest-700">
                  <BrandBackdrop />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Icon name="photo_camera" className="text-[32px] text-paper opacity-70" />
                  </span>
                  <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-[color:var(--scrim-ink-70)] px-2.5 py-1 text-[13px] font-semibold text-paper">
                    {big ? EMPTY_BIG_LABEL : EMPTY_SMALL_LABEL}
                  </span>
                </div>
              </li>
            );
          }
          const { tile } = slot;
          return (
            <li key={tile.photo.url} className={cell}>
              <button
                type="button"
                onClick={() => (tile.more ? viewer.openAt(0) : viewer.openPhoto(tile.photo))}
                aria-label={tile.more ? allPhotosLabel(photos.length) : `${tile.caption}: ampliar la foto`}
                className="group relative block size-full overflow-hidden rounded-field bg-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <Image
                  src={tile.photo.url}
                  alt={`${tile.caption}, ${name}${place}`}
                  fill
                  sizes={big ? "(max-width: 640px) 60vw, 440px" : "(max-width: 640px) 40vw, 220px"}
                  className="object-cover transition-transform duration-500 ease-out-fresh motion-safe:group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-[color:var(--scrim-ink-70)] px-2.5 py-1 text-[13px] font-semibold text-paper">
                  {tile.caption}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {hasEmpty && <p className="sr-only">{emptyMosaicNote(photos.length)}</p>}
      {photos.length > 0 && (
      <button
        type="button"
        onClick={() => viewer.openAt(0)}
        className="mt-3 inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-forest-700 bg-paper px-[18px] text-[15px] font-bold text-forest-700 transition-colors duration-200 ease-out-fresh hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Icon name="photo_library" className="text-xl" />
        {allPhotosLabel(photos.length)}
      </button>
      )}
      {viewer.node}
    </>
  );
}
