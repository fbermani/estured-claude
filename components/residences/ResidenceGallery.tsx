import Image from "next/image";
import { getGalleryLayout } from "@/lib/residences/photos";
import { ResidencePhotoPlaceholder } from "@/components/residences/ResidencePhoto";
import { GalleryMosaic } from "@/components/residences/GalleryMosaic";

/**
 * Hero de la ficha que se adapta a cuántas fotos hay (Ciclo 54, D12):
 * 0 → placeholder de marca grande · 1 → imagen única · 2–4 → mosaico ·
 * 5+ → mosaico con "Ver todas". La variante sale de `getGalleryLayout`
 * (lib/residences/photos.ts, con tests). Cada variante tiene alto fijo, así
 * que no hay salto de layout al cargar las imágenes.
 */
export function ResidenceGallery({ photos, name, zone }: { photos: string[]; name: string; zone: string }) {
  const layout = getGalleryLayout(photos.length);
  const place = zone ? ` en ${zone}` : "";

  if (layout === "empty") {
    return (
      <div className="relative h-[150px] overflow-hidden rounded-card sm:h-[200px]">
        <ResidencePhotoPlaceholder name={name} zone={zone} variant="hero" label="Foto próximamente" />
      </div>
    );
  }

  if (layout === "single") {
    return (
      <div className="relative h-72 overflow-hidden rounded-card bg-sand-200 sm:h-96">
        <Image
          src={photos[0]}
          alt={`Foto de ${name}${place}`}
          fill
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="object-cover"
          priority
        />
      </div>
    );
  }

  return <GalleryMosaic photos={photos} name={name} zone={zone} layout={layout} />;
}
