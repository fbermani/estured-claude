import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { pickRotationPhotos, type GalleryPhoto, type PhotoArea, type PhotoCategory } from "@/lib/residences/photoMeta";
import { buildPhotoSections, reconcileAssignment, type PhotoSectionDef } from "@/lib/residences/photoSections";
import { normalizeAmenityLists } from "@/lib/residences/amenityDetails";
import { COMMON_AREA_OPTIONS } from "@/lib/residences/options";

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
  /** Migración 0074: ausente si todavía no está aplicada. */
  cover_order?: number | null;
  /** Migración 0097: foto principal (una por residencia); ausente si todavía no está aplicada. */
  is_cover?: boolean;
};

/**
 * Ajusta la clasificación de una fila a las secciones vigentes de su residencia (áreas comunes elegidas, «Otro» aprobados, tipos activos):
 * lo que ya no tiene sección pasa a «general» sin nombre (en la ficha, «Fotos adicionales») y los nombres de sección se unifican con los actuales.
 * No toca portada ni orden. Sin la 0070 (`sectionsReady: false`) no se escribe `section`.
 */
export function reconcileMetaRow(row: PhotoMetaRow, defs: PhotoSectionDef[], sectionsReady: boolean): PhotoMetaRow {
  const next = reconcileAssignment(
    { category: row.category, area: (row.area ?? null) as PhotoArea | null, roomTypeId: row.room_type_id, section: row.section ?? null },
    defs,
  );
  return {
    ...row,
    category: next.category,
    area: next.area,
    room_type_id: next.roomTypeId,
    ...(sectionsReady ? { section: next.section } : {}),
  };
}

type SectionRow = { residence_id: string; section_type: string; content: { items?: unknown } | null };

/** Secciones de fotos vigentes por residencia (solo lo público: «Otro» aprobados y tipos activos). `null` si algo falla: se muestra la clasificación guardada. */
async function loadSectionDefsByResidence(admin: SupabaseClient, residenceIds: string[], sectionsReady: boolean): Promise<Map<string, PhotoSectionDef[]> | null> {
  const [sectionsRes, typesRes, customRes] = await Promise.all([
    admin.from("residence_profile_sections").select("residence_id, section_type, content").in("residence_id", residenceIds).in("section_type", ["common_areas", "services"]),
    admin.from("room_types").select("id, residence_id, name").in("residence_id", residenceIds).eq("is_active", true).order("created_at", { ascending: true }),
    admin.from("residence_custom_amenities").select("residence_id, label").in("residence_id", residenceIds).eq("kind", "area").eq("status", "approved").order("created_at", { ascending: true }),
  ]);
  if (sectionsRes.error || typesRes.error) {
    console.error("[photo-meta] no se pudieron leer las secciones vigentes:", sectionsRes.error?.message ?? typesRes.error?.message);
    return null;
  }
  // Sin la 0058 no hay ítems «Otro»: es lo esperado, no un error.
  if (customRes.error && !isMissingSchemaError(customRes.error)) {
    console.error("[photo-meta] no se pudieron leer los «Otro» aprobados:", customRes.error.message);
    return null;
  }
  const items = (r: SectionRow) => (Array.isArray(r.content?.items) ? (r.content.items as unknown[]).filter((x): x is string => typeof x === "string") : []);
  const out = new Map<string, PhotoSectionDef[]>();
  for (const id of residenceIds) {
    const rows = ((sectionsRes.data ?? []) as SectionRow[]).filter((r) => r.residence_id === id);
    const { commonAreas } = normalizeAmenityLists({
      services: rows.filter((r) => r.section_type === "services").flatMap(items),
      commonAreas: rows.filter((r) => r.section_type === "common_areas").flatMap(items),
    });
    out.set(
      id,
      buildPhotoSections({
        commonAreas: COMMON_AREA_OPTIONS.filter((a) => commonAreas.includes(a)),
        customAreas: ((customRes.data ?? []) as { residence_id: string; label: string }[])
          .filter((c) => c.residence_id === id)
          .map((c) => ({ label: c.label, status: "approved" as const })),
        roomTypes: ((typesRes.data ?? []) as { id: string; residence_id: string; name: string }[]).filter((t) => t.residence_id === id),
        sectionNamesReady: sectionsReady,
      }),
    );
  }
  return out;
}

/**
 * Metadatos de fotos por `file_id`. Sin la migración 0059 (o ante un error) devuelve `schemaReady: false` y vacío: todo queda «general».
 * Por defecto la clasificación sale ajustada a lo que la residencia tiene hoy (`reconcileMetaRow`), que es lo que ve el público: un área
 * destildada, un tipo desactivado o un «Otro» sin aprobar no generan sección. El editor del dueño y el catálogo piden `reconcile: false`
 * (el editor ajusta con sus propias secciones, que incluyen lo que todavía no se guardó; el catálogo solo usa portada y orden).
 */
export async function loadPhotoMeta(
  admin: SupabaseClient,
  residenceIds: string[],
  opts: { reconcile?: boolean } = {},
): Promise<{ byFileId: Map<string, PhotoMetaRow>; schemaReady: boolean; sectionsReady: boolean; coverReady: boolean; mainCoverReady: boolean }> {
  const byFileId = new Map<string, PhotoMetaRow>();
  if (residenceIds.length === 0) return { byFileId, schemaReady: true, sectionsReady: true, coverReady: true, mainCoverReady: true };
  const base = "file_id, residence_id, category, area, room_type_id, is_featured";
  // Se prueba con todas las columnas y se va degradando: 0097 (is_cover) → 0074 (cover_order) → 0070 (section / sort_order) → 0059.
  const tiers = [
    { cols: `${base}, section, sort_order, cover_order, is_cover`, sectionsReady: true, coverReady: true, mainCoverReady: true },
    { cols: `${base}, section, sort_order, cover_order`, sectionsReady: true, coverReady: true, mainCoverReady: false },
    { cols: `${base}, section, sort_order`, sectionsReady: true, coverReady: false, mainCoverReady: false },
    { cols: base, sectionsReady: false, coverReady: false, mainCoverReady: false },
  ];
  let data: unknown[] | null = null;
  let error: { code?: string | null; message?: string | null } | null = null;
  let tier = tiers[0];
  for (const t of tiers) {
    tier = t;
    ({ data, error } = await admin.from("residence_photo_meta").select(t.cols).in("residence_id", residenceIds));
    if (!error || !isMissingSchemaError(error)) break;
  }
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[photo-meta] lectura fallida:", error.code, error.message);
    return { byFileId, schemaReady: false, sectionsReady: false, coverReady: false, mainCoverReady: false };
  }
  const rows = (data ?? []) as PhotoMetaRow[];
  const withClassification = rows.some((r) => r.category !== "general" || r.section);
  const defsByResidence =
    opts.reconcile !== false && withClassification
      ? await loadSectionDefsByResidence(admin, [...new Set(rows.map((r) => r.residence_id))], tier.sectionsReady)
      : null;
  for (const row of rows) {
    const defs = defsByResidence?.get(row.residence_id);
    byFileId.set(row.file_id, defs ? reconcileMetaRow(row, defs, tier.sectionsReady) : row);
  }
  return { byFileId, schemaReady: true, sectionsReady: tier.sectionsReady, coverReady: tier.coverReady, mainCoverReady: tier.mainCoverReady };
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
      coverOrder: m?.cover_order ?? null,
      isCover: m?.is_cover === true,
    };
  });
}

/** URLs que rotan (destacadas o primeras 5). */
export function rotationUrls(photos: GalleryPhoto[]): string[] {
  return pickRotationPhotos(photos).map((p) => p.url);
}
