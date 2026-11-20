"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SearchResultCard } from "@/components/residences/SearchResultCard";
import { buildPreviewResidence, type PreviewPhoto, type PreviewRoomType } from "@/lib/residences/profilePreview";
import type { AvailabilityMode } from "@/types/domain";

/**
 * Vista previa de la configuración: la MISMA tarjeta que ven los estudiantes en /search (`SearchResultCard`), armada con lo que hay hoy
 * en el formulario y la foto de portada real. Es una miniatura: no se puede tocar (`inert`, así no navega ni abre nada) y el botón lleva a
 * la ficha completa en una pestaña nueva (`/residence/<id>/preview`, que muestra lo último GUARDADO, no lo que está escrito sin guardar).
 */
export function ProfilePreviewCard({
  residenceId,
  slug,
  name,
  zone,
  status,
  availabilityMode,
  description,
  services,
  commonAreas,
  approvedExtraServices,
  approvedExtraAreas,
  nearUniversities,
  roomTypes,
  photos,
  location,
  arsPerUsd,
  hasUnsavedChanges,
}: {
  residenceId: string;
  slug: string;
  name: string;
  zone: string;
  status: string;
  availabilityMode: AvailabilityMode;
  description: string;
  services: Iterable<string>;
  commonAreas: Iterable<string>;
  approvedExtraServices: string[];
  approvedExtraAreas: string[];
  nearUniversities: Iterable<string>;
  roomTypes: PreviewRoomType[];
  photos: PreviewPhoto[];
  location: { lat: number; lng: number } | null;
  arsPerUsd: number;
  hasUnsavedChanges: boolean;
}) {
  const residence = buildPreviewResidence({
    slug,
    name,
    zone,
    status,
    availabilityMode,
    description,
    services,
    commonAreas,
    approvedExtraServices,
    approvedExtraAreas,
    nearUniversities,
    roomTypes,
    photos,
    location,
  });

  return (
    <Card className="overflow-hidden p-0">
      <p className="border-b border-sand-200 px-5 py-3 text-sm font-bold text-ink">Vista previa</p>
      <div className="p-4">
        <p className="mb-3 text-xs text-ink-soft">Así se ve tu tarjeta en la búsqueda, con lo que cargaste ahora.</p>
        {/* Miniatura: inerte y oculta a lectores de pantalla (es una representación; el enlace de abajo es la acción real). */}
        <div inert aria-hidden="true" className="pointer-events-none select-none">
          <SearchResultCard residence={residence} arsPerUsd={arsPerUsd} layout="grid" />
        </div>
        <a
          href={`/residence/${residenceId}/preview`}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-line-2 bg-paper px-5 text-sm font-bold text-ink transition-colors hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Ver la ficha completa
          <Icon name="open_in_new" className="text-lg" />
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </a>
        <p className="mt-2 text-xs text-ink-soft">Muestra lo último que guardaste.</p>
        {hasUnsavedChanges && (
          <p role="status" className="mt-2 rounded-field bg-warning-bg px-3 py-2 text-xs font-medium text-warning-fg">
            Guardá para ver estos cambios.
          </p>
        )}
      </div>
    </Card>
  );
}
