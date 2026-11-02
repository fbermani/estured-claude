"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import {
    MAX_FEATURED_PHOTOS,
  MAX_SECTION_LENGTH,
  PHOTO_AREAS,
  SECTION_SUGGESTIONS,
  effectiveSection,
  groupPhotosBySections,
  type PhotoArea,
  type PhotoCategory,
} from "@/lib/residences/photoMeta";
import { savePhotoMeta } from "@/app/residence/[residence_id]/profile/photoMetaActions";

export type PhotoMetaItem = {
  id: string;
  url: string;
  pending: boolean;
  category: PhotoCategory;
  area: PhotoArea | null;
  roomTypeId: string | null;
  featured: boolean;
  section: string | null;
  sortOrder: number;
};

/**
 * Editor de la galería (DR18, tanda 2): a cada foto se le asigna categoría (general / por área / por tipo de habitación) y se eligen
 * hasta 5 destacadas, que son las que rotan en la ficha y la tarjeta. Guarda por su cuenta (no depende del botón del perfil) y el
 * servidor valida todo. Vive dentro del <form> del perfil, por eso todos sus botones son type="button" y sus campos no tienen `name`.
 */
export function PhotoMetaManager({
  residenceId,
  initialItems,
  roomTypes,
  schemaReady,
  sectionsReady,
  readOnly,
}: {
  residenceId: string;
  initialItems: PhotoMetaItem[];
  roomTypes: { id: string; name: string }[];
  schemaReady: boolean;
  sectionsReady: boolean;
  readOnly: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const featuredCount = items.filter((i) => i.featured).length;

  function patch(id: string, change: Partial<PhotoMetaItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...change } : i)));
    setDirty(true);
    setFeedback(null);
  }

  function save() {
    startSave(async () => {
      // El orden guardado es el de la vista agrupada por sección («Fotos adicionales» al final).
      const order = new Map(groupPhotosBySections(items.map((i) => ({ ...i, roomTypeName: roomTypes.find((r) => r.id === i.roomTypeId)?.name ?? null }))).flatMap((g) => g.photos).map((p, n) => [p.id, n]));
      const result = await savePhotoMeta(
        residenceId,
        items.map((i) => ({
          fileId: i.id,
          category: i.category,
          area: i.area,
          roomTypeId: i.roomTypeId,
          featured: i.featured,
          section: i.section,
          sortOrder: order.get(i.id) ?? 0,
        })),
      );
      setFeedback({ ok: result.status === "success", text: result.message ?? "" });
      if (result.status === "success") setDirty(false);
    });
  }

  if (items.length === 0) return null;
  const groups = groupPhotosBySections(
    items.map((i) => ({ ...i, roomTypeName: roomTypes.find((r) => r.id === i.roomTypeId)?.name ?? null })),
  );

  if (!schemaReady)
    return (
      <p className="mt-4 rounded-field bg-sand-50 p-3 text-sm text-ink-soft">
        Muy pronto vas a poder ordenar tus fotos por área y por tipo de habitación, y elegir cuáles rotan en tu ficha.
      </p>
    );

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-ink-soft">
        Indicá qué muestra cada foto y destacá hasta {MAX_FEATURED_PHOTOS}: esas rotan en tu ficha y en la tarjeta de búsqueda. Si no
        destacás ninguna, rotan las primeras {MAX_FEATURED_PHOTOS}.{" "}
        <strong className="text-ink">
          Destacadas: {featuredCount} de {MAX_FEATURED_PHOTOS}
        </strong>
      </p>
      {sectionsReady && (
        <datalist id="photo-section-suggestions">
          {SECTION_SUGGESTIONS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      )}
      {groups.map((group) => (
      <section key={group.key} aria-label={`Sección ${group.title}`} className="space-y-2">
        {sectionsReady && (
          <h4 className="text-sm font-bold text-ink">
            {group.title} <span className="font-normal text-ink-faint">({group.photos.length})</span>
          </h4>
        )}
      <ul className="grid gap-3 min-[1500px]:grid-cols-2">
        {group.photos.map((photo) => {
          const idx = items.findIndex((i) => i.id === photo.id);
          const canFeature = photo.featured || featuredCount < MAX_FEATURED_PHOTOS;
          return (
            <li key={photo.id} className="flex gap-3 rounded-card border border-sand-200 p-3">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-field bg-sand-200">
                <Image src={photo.url} alt={`Foto ${idx + 1} de tu galería`} fill sizes="96px" className="object-cover" />
                {photo.pending && (
                  <div className="absolute bottom-1 left-1">
                    <Badge tone="amber">Pendiente</Badge>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {sectionsReady && (
                  <div>
                    <label htmlFor={`section-${photo.id}`} className="mb-1 block text-sm font-medium text-ink">
                      Sección
                    </label>
                    <input
                      id={`section-${photo.id}`}
                      type="text"
                      list="photo-section-suggestions"
                      maxLength={MAX_SECTION_LENGTH}
                      value={photo.section ?? ""}
                      placeholder={effectiveSection({ ...photo, roomTypeName: roomTypes.find((r) => r.id === photo.roomTypeId)?.name ?? null })}
                      disabled={readOnly}
                      onChange={(e) => patch(photo.id, { section: e.target.value === "" ? null : e.target.value })}
                      className="w-full rounded-field border border-sand-300 bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
                    />
                  </div>
                )}
                <Select
                  label="¿Qué muestra?"
                  value={photo.category}
                  disabled={readOnly}
                  onChange={(e) => {
                    const category = e.target.value as PhotoCategory;
                    patch(photo.id, {
                      category,
                      area: category === "area" ? (photo.area ?? "cocina") : null,
                      roomTypeId: category === "room_type" ? (photo.roomTypeId ?? roomTypes[0]?.id ?? null) : null,
                    });
                  }}
                >
                  <option value="general">General</option>
                  <option value="area">Un área (cocina, patio…)</option>
                  {roomTypes.length > 0 && <option value="room_type">Un tipo de habitación</option>}
                </Select>
                {photo.category === "area" && (
                  <Select
                    label="Área"
                    value={photo.area ?? "cocina"}
                    disabled={readOnly}
                    onChange={(e) => patch(photo.id, { area: e.target.value as PhotoArea })}
                  >
                    {PHOTO_AREAS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                )}
                {photo.category === "room_type" && (
                  <Select
                    label="Tipo de habitación"
                    value={photo.roomTypeId ?? ""}
                    disabled={readOnly}
                    onChange={(e) => patch(photo.id, { roomTypeId: e.target.value || null })}
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name}
                      </option>
                    ))}
                  </Select>
                )}
                <label className={`flex items-center gap-2 text-sm ${canFeature && !readOnly ? "text-ink" : "text-ink-faint"}`}>
                  <input
                    type="checkbox"
                    checked={photo.featured}
                    disabled={readOnly || !canFeature}
                    onChange={(e) => patch(photo.id, { featured: e.target.checked })}
                    className="h-4 w-4 accent-forest"
                  />
                  Destacada (rota en la ficha)
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      </section>
      ))}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? "Guardando…" : "Guardar clasificación de fotos"}
          </Button>
          {feedback && (
            <p role="status" className={`text-sm ${feedback.ok ? "text-forest-700" : "text-danger"}`}>
              {feedback.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
