import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { pickRotationPhotos, type GalleryPhoto, type PhotoCategory } from "@/lib/residences/photoMeta";

export type PhotoMetaRow = {
  file_id: string;
  residence_id: string;
  category: PhotoCategory;
  area: string | null;
  room_type_id: string | null;
  is_featured: boolean;
  /** Migración 0070: ausentes si todavía no está aplicada. */
  section?: string | null;
  sort_order?: number;
};

/** Metadatos de fotos por `file_id`. Sin la migración 0059 (o ante un error) devuelve `schemaReady: false` y vacío: todo queda «general». */
export async function loadPhotoMeta(
  admin: SupabaseClient,
  residenceIds: string[],
): Promise<{ byFileId: Map<string, PhotoMetaRow>; schemaReady: boolean; sectionsReady: boolean }> {
  const byFileId = new Map<string, PhotoMetaRow>();
  if (residenceIds.length === 0) return { byFileId, schemaReady: true, sectionsReady: true };
  const base = "file_id, residence_id, category, area, room_type_id, is_featured";
  let { data, error }: { data: unknown[] | null; error: { code?: string | null; message?: string | null } | null } = await admin.from("residence_photo_meta").select(`${base}, section, sort_order`).in("residence_id", residenceIds);
  // Sin la migración 0070 (columnas section / sort_order) se degrada a lo de 0059.
  let sectionsReady = true;
  if (error && isMissingSchemaError(error)) {
    sectionsReady = false;
    ({ data, error } = await admin.from("residence_photo_meta").select(base).in("residence_id", residenceIds));
  }
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[photo-meta] lectura fallida:", error.code, error.message);
    return { byFileId, schemaReady: false, sectionsReady: false };
  }
  for (const row of (data ?? []) as PhotoMetaRow[]) byFileId.set(row.file_id, row);
  return { byFileId, schemaReady: true, sectionsReady };
}

/** Une fotos aprobadas con sus metadatos (el orden es la antigüedad, que ya trae la consulta; el editor no reordena). */
export function buildGalleryPhotos(
  files: { id: string; storage_path: string }[],
  meta: Map<string, PhotoMetaRow>,
  urlFor: (storagePath: string) => string,
  roomTypeNames: Map<string, string>,
): GalleryPhoto[] {
  return files.map((f) => {
    const m = meta.get(f.id);
    return {
      url: urlFor(f.storage_path),
      category: m?.category ?? "general",
      area: m?.area ?? null,
      roomTypeName: m?.room_type_id ? (roomTypeNames.get(m.room_type_id) ?? null) : null,
      featured: m?.is_featured === true,
      section: m?.section ?? null,
      sortOrder: m?.sort_order ?? 0,
    };
  });
}

/** URLs que rotan (destacadas o primeras 5). */
export function rotationUrls(photos: GalleryPhoto[]): string[] {
  return pickRotationPhotos(photos).map((p) => p.url);
}
