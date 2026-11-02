"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidencePermission } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { MAX_FEATURED_PHOTOS, validatePhotoMeta } from "@/lib/residences/photoMeta";

export type PhotoMetaState = { status: "idle" | "success" | "error"; message?: string };

/**
 * Guarda la clasificación de las fotos (DR18 fase 2, migración 0059; DR30, 0070): categoría, área, tipo de habitación, sección con nombre, orden y destacadas (hasta 5).
 * No pasa por la cola de revisión: no cambia qué fotos son públicas, solo cómo se agrupan y cuáles rotan. Requiere `profile.edit`;
 * las fotos y los tipos se validan contra los de ESTA residencia (nunca se confía en los ids del cliente).
 */
export async function savePhotoMeta(residenceId: string, items: unknown): Promise<PhotoMetaState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const access = await assertResidencePermission(admin, sessionUser.id, residenceId, "profile.edit");
  if (!access.ok) return { status: "error", message: access.error };

  const [{ data: files, error: filesError }, { data: types, error: typesError }] = await Promise.all([
    admin
      .from("files")
      .select("id")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residenceId)
      .eq("document_type", "residence_photo")
      .neq("status", "rejected"),
    admin.from("room_types").select("id").eq("residence_id", residenceId).eq("is_active", true),
  ]);
  if (filesError || typesError) return { status: "error", message: "No pudimos guardar las fotos. Probá de nuevo en unos minutos." };

  const checked = validatePhotoMeta(items, {
    validFileIds: new Set((files ?? []).map((f) => f.id as string)),
    validRoomTypeIds: new Set((types ?? []).map((t) => t.id as string)),
  });
  if (!checked.ok) return { status: "error", message: checked.error };

  // El tope de destacadas cuenta también las filas existentes que este envío no incluye (p. ej. fotos subidas desde otra pestaña).
  const sentIds = checked.items.map((i) => i.fileId);
  const { data: existing, error: existingError } = await admin
    .from("residence_photo_meta")
    .select("file_id")
    .eq("residence_id", residenceId)
    .eq("is_featured", true);
  if (existingError) {
    if (isMissingSchemaError(existingError))
      return { status: "error", message: "La clasificación de fotos todavía no está disponible. Probá más tarde." };
    return { status: "error", message: "No pudimos guardar las fotos. Probá de nuevo en unos minutos." };
  }
  const unsentFeatured = (existing ?? []).filter((e) => !sentIds.includes(e.file_id as string)).length;
  if (checked.items.filter((i) => i.featured).length + unsentFeatured > MAX_FEATURED_PHOTOS)
    return { status: "error", message: `Podés destacar hasta ${MAX_FEATURED_PHOTOS} fotos. Recargá la página para ver cuáles ya están destacadas.` };

  const rows = checked.items.map((i) => ({
    file_id: i.fileId,
    residence_id: residenceId,
    category: i.category,
    area: i.area,
    room_type_id: i.roomTypeId,
    is_featured: i.featured,
    section: i.section,
    sort_order: i.sortOrder,
  }));
  if (rows.length > 0) {
    let { error } = await admin.from("residence_photo_meta").upsert(rows, { onConflict: "file_id" });
    // Sin la migración 0070 (section / sort_order) se guarda solo lo de 0059.
    if (error && isMissingSchemaError(error)) {
      if (checked.items.some((i) => i.section || i.sortOrder))
        return { status: "error", message: "Las secciones de fotos todavía no están disponibles. Probá más tarde." };
      const legacy = rows.map((r) => ({ file_id: r.file_id, residence_id: r.residence_id, category: r.category, area: r.area, room_type_id: r.room_type_id, is_featured: r.is_featured }));
      ({ error } = await admin.from("residence_photo_meta").upsert(legacy, { onConflict: "file_id" }));
    }
    if (error) {
      if (isMissingSchemaError(error))
        return { status: "error", message: "La clasificación de fotos todavía no está disponible. Probá más tarde." };
      console.error("[photo-meta] upsert fallido:", error.code, error.message);
      return { status: "error", message: "No pudimos guardar las fotos. Probá de nuevo en unos minutos." };
    }
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: access.actorRole,
    action: "residence_photo_meta_updated",
    entityType: "residences",
    entityId: residenceId,
    newValue: { photos: rows.length, featured: checked.items.filter((i) => i.featured).length },
  });
  revalidatePath(`/residence/${residenceId}/profile`);
  return { status: "success", message: "Listo, guardamos cómo se muestran tus fotos." };
}
