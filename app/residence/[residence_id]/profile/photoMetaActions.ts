"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidencePermission } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { MAX_FEATURED_PHOTOS, validatePhotoMeta } from "@/lib/residences/photoMeta";
import { MAX_RESIDENCE_PHOTOS, photoDeleteBlockedMessage } from "@/lib/residences/photos";
import { imageExtension, sniffImageType } from "@/lib/residences/imageSniff";
import { stageProfileEdit } from "@/lib/residences/profileEdits";
import type { PhotoMetaItem } from "@/lib/residences/photoSections";
import { safeFilename } from "@/lib/files/safeFilename";

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
    return { status: "error", message: `Podés elegir hasta ${MAX_FEATURED_PHOTOS} fotos de portada. Recargá la página para ver cuáles ya lo son.` };

  const rows = checked.items.map((i) => ({
    file_id: i.fileId,
    residence_id: residenceId,
    category: i.category,
    area: i.area,
    room_type_id: i.roomTypeId,
    is_featured: i.featured,
    section: i.section,
    sort_order: i.sortOrder,
    cover_order: i.coverOrder,
  }));
  if (rows.length > 0) {
    let { error } = await admin.from("residence_photo_meta").upsert(rows, { onConflict: "file_id" });
    // Sin la migración 0074 (cover_order) se guarda sin el orden de portada: rotan según el orden de la galería.
    if (error && isMissingSchemaError(error)) {
      const withoutCover = rows.map((r) => ({ file_id: r.file_id, residence_id: r.residence_id, category: r.category, area: r.area, room_type_id: r.room_type_id, is_featured: r.is_featured, section: r.section, sort_order: r.sort_order }));
      ({ error } = await admin.from("residence_photo_meta").upsert(withoutCover, { onConflict: "file_id" }));
    }
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
  return { status: "success", message: "Guardado." };
}

export type PhotoUploadState = { status: "success"; photo: PhotoMetaItem } | { status: "error"; message: string };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];

/**
 * Sube UNA foto de la galería (el editor las manda de a una, para mostrar el avance y reintentar solo la que falló) y, si viene con destino,
 * la deja clasificada (`category` / `area` / `roomTypeId` / `section`). Mismas reglas que el guardado del perfil: JPG/PNG/WebP de hasta 5 MB;
 * si la residencia ya está publicada la foto entra `pending_review` y se encola la revisión del admin (nunca se muestra al público antes);
 * si no, entra aprobada. Requiere `profile.edit`; el destino se valida contra los tipos de habitación de ESTA residencia.
 */
export async function uploadResidencePhoto(residenceId: string, formData: FormData): Promise<PhotoUploadState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const access = await assertResidencePermission(admin, sessionUser.id, residenceId, "profile.edit");
  if (!access.ok) return { status: "error", message: access.error };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { status: "error", message: "No pudimos leer la foto. Probá de nuevo." };
  if (photo.size > MAX_PHOTO_BYTES) return { status: "error", message: `"${photo.name}" pesa más de 5 MB.` };
  if (!PHOTO_MIME.includes(photo.type)) return { status: "error", message: `"${photo.name}" tiene que ser JPG, PNG o WebP.` };
  // El MIME lo declara el cliente: el tipo (y la extensión) que se guardan salen de la firma real del archivo.
  const photoBytes = new Uint8Array(await photo.arrayBuffer());
  const realType = sniffImageType(photoBytes);
  if (!realType) return { status: "error", message: `"${photo.name}" no es una imagen JPG, PNG o WebP válida.` };

  const [{ data: residence }, { count }, { data: types }] = await Promise.all([
    admin.from("residences").select("status").eq("id", residenceId).single(),
    admin
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residenceId)
      .eq("document_type", "residence_photo")
      .neq("status", "rejected"),
    admin.from("room_types").select("id").eq("residence_id", residenceId).eq("is_active", true),
  ]);
  if (!residence) return { status: "error", message: "No encontramos la residencia." };
  if ((count ?? 0) >= MAX_RESIDENCE_PHOTOS)
    return { status: "error", message: `Llegaste al máximo de ${MAX_RESIDENCE_PHOTOS} fotos. Para sumar otra, primero pedile a Soporte que quite alguna.` };

  // El destino (opcional) se valida antes de subir nada.
  const hasTarget = typeof formData.get("category") === "string";
  let target: ReturnType<typeof validatePhotoMeta> | null = null;
  if (hasTarget) {
    target = validatePhotoMeta(
      [
        {
          fileId: "new",
          category: formData.get("category"),
          area: formData.get("area") || null,
          roomTypeId: formData.get("roomTypeId") || null,
          section: formData.get("section") || null,
          featured: false,
          sortOrder: 0,
        },
      ],
      { validFileIds: new Set(["new"]), validRoomTypeIds: new Set((types ?? []).map((t) => t.id as string)) },
    );
    if (!target.ok) return { status: "error", message: target.error };
  }

  const gateApplies = residence.status === "verified_active";
  const path = `${residenceId}/${crypto.randomUUID()}.${imageExtension(realType)}`;
  const { error: uploadError } = await admin.storage.from("public-residence-media").upload(path, photoBytes, { contentType: realType });
  if (uploadError) {
    console.error("[photo-upload] storage fallido:", uploadError.message);
    return { status: "error", message: `No pudimos subir "${photo.name}". Probá de nuevo.` };
  }
  const { data: inserted, error: insertError } = await admin
    .from("files")
    .insert({
      owner_user_id: sessionUser.id,
      related_entity_type: "residences",
      related_entity_id: residenceId,
      bucket: "public-residence-media",
      storage_path: path,
      filename: safeFilename(photo.name),
      mime_type: realType,
      size_bytes: photo.size,
      visibility: "public",
      document_type: "residence_photo",
      status: gateApplies ? "pending_review" : "approved",
      uploaded_by_user_id: sessionUser.id,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("[photo-upload] insert fallido:", insertError?.message);
    await admin.storage.from("public-residence-media").remove([path]);
    return { status: "error", message: `No pudimos guardar "${photo.name}". Probá de nuevo.` };
  }
  const fileId = inserted.id as string;

  // Publicada: la foto espera la aprobación del admin. Se suman a la revisión pendiente las que ya estaban (stageProfileEdit reemplaza la anterior).
  if (gateApplies) {
    const { data: pendingEdit } = await admin
      .from("residence_profile_edits")
      .select("new_value")
      .eq("residence_id", residenceId)
      .eq("field_group", "photos")
      .eq("status", "pending_admin_review")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const previousIds = ((pendingEdit?.new_value as { fileIds?: string[] } | null)?.fileIds ?? []).filter((id) => typeof id === "string");
    const stage = await stageProfileEdit(admin, {
      residenceId,
      fieldGroup: "photos",
      oldValue: null,
      newValue: { fileIds: [...previousIds, fileId] },
      submittedByUserId: sessionUser.id,
    });
    if (!stage.ok) {
      await admin.from("files").update({ status: "rejected" }).eq("id", fileId);
      await admin.storage.from("public-residence-media").remove([path]);
      return { status: "error", message: stage.error };
    }
  }

  let placed: Pick<PhotoMetaItem, "category" | "area" | "roomTypeId" | "section"> = { category: "general", area: null, roomTypeId: null, section: null };
  if (target?.ok) {
    const t = target.items[0];
    const row = { file_id: fileId, residence_id: residenceId, category: t.category, area: t.area, room_type_id: t.roomTypeId, section: t.section, sort_order: 0 };
    let { error: metaError } = await admin.from("residence_photo_meta").insert(row);
    // Sin la migración 0070 se guarda solo lo de 0059; sin 0059 la foto queda sin clasificar (se ve igual).
    if (metaError && isMissingSchemaError(metaError)) {
      const legacy = { file_id: row.file_id, residence_id: row.residence_id, category: row.category, area: row.area, room_type_id: row.room_type_id };
      ({ error: metaError } = await admin.from("residence_photo_meta").insert(legacy));
    }
    if (!metaError) placed = { category: t.category, area: t.area, roomTypeId: t.roomTypeId, section: t.section };
    else if (!isMissingSchemaError(metaError)) console.error("[photo-upload] meta fallida:", metaError.code, metaError.message);
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: access.actorRole,
    action: "residence_photo_uploaded",
    entityType: "residences",
    entityId: residenceId,
    newValue: { file_id: fileId, pending_review: gateApplies },
  });
  revalidatePath(`/residence/${residenceId}/profile`);
  return {
    status: "success",
    photo: {
      id: fileId,
      url: admin.storage.from("public-residence-media").getPublicUrl(path).data.publicUrl,
      pending: gateApplies,
      category: placed.category,
      area: placed.area,
      roomTypeId: placed.roomTypeId,
      section: placed.section,
      featured: false,
      sortOrder: 0,
      coverOrder: null,
    },
  };
}

export type PhotoDeleteState = { status: "success" } | { status: "error"; message: string };

/**
 * El dueño (o staff con `profile.edit`) borra una foto SUYA de la galería (DR36). No pasa por el admin: borrar nunca muestra contenido sin
 * revisar. Piso: en una residencia publicada no se puede dejar menos de 3 fotos aprobadas (`photoDeleteBlockedMessage`). La fila de `files`
 * queda `rejected` (todo el sistema ya excluye ese estado) como registro, se borra su clasificación y el archivo del bucket público, y se
 * la saca de la revisión pendiente del admin (para que no se «apruebe» una foto sin archivo).
 */
export async function deleteResidencePhoto(residenceId: string, fileId: string): Promise<PhotoDeleteState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const access = await assertResidencePermission(admin, sessionUser.id, residenceId, "profile.edit");
  if (!access.ok) return { status: "error", message: access.error };
  if (typeof fileId !== "string" || !fileId) return { status: "error", message: "No encontramos esa foto." };

  // La foto tiene que ser de ESTA residencia (nunca se confía en el id del cliente).
  const { data: file } = await admin
    .from("files")
    .select("id, status, storage_path, bucket")
    .eq("id", fileId)
    .eq("related_entity_type", "residences")
    .eq("related_entity_id", residenceId)
    .eq("document_type", "residence_photo")
    .neq("status", "rejected")
    .maybeSingle();
  if (!file) return { status: "error", message: "No encontramos esa foto. Puede que ya la hayas borrado." };

  const [{ data: residence }, { count: approvedCount }] = await Promise.all([
    admin.from("residences").select("status").eq("id", residenceId).single(),
    admin
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residenceId)
      .eq("document_type", "residence_photo")
      .eq("status", "approved"),
  ]);
  if (!residence) return { status: "error", message: "No encontramos la residencia." };
  const blocked = photoDeleteBlockedMessage({
    published: residence.status === "verified_active",
    photoStatus: file.status as string,
    approvedCount: approvedCount ?? 0,
  });
  if (blocked) return { status: "error", message: blocked };

  const { error: updateError } = await admin.from("files").update({ status: "rejected" }).eq("id", fileId).eq("status", file.status as string);
  if (updateError) {
    console.error("[photo-delete] update fallido:", updateError.message);
    return { status: "error", message: "No pudimos borrar la foto. Probá de nuevo." };
  }
  const { error: metaError } = await admin.from("residence_photo_meta").delete().eq("file_id", fileId);
  if (metaError && !isMissingSchemaError(metaError)) console.error("[photo-delete] meta fallida:", metaError.code, metaError.message);
  if (file.bucket === "public-residence-media" && file.storage_path) {
    const { error: removeError } = await admin.storage.from("public-residence-media").remove([file.storage_path as string]);
    if (removeError) console.error("[photo-delete] storage fallido:", removeError.message);
  }

  // Si estaba en una revisión de fotos pendiente, se la saca; si no queda ninguna, la revisión se cancela.
  const { data: pendingEdit } = await admin
    .from("residence_profile_edits")
    .select("id, new_value")
    .eq("residence_id", residenceId)
    .eq("field_group", "photos")
    .eq("status", "pending_admin_review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pendingIds = ((pendingEdit?.new_value as { fileIds?: string[] } | null)?.fileIds ?? []).filter((id) => typeof id === "string");
  if (pendingEdit && pendingIds.includes(fileId)) {
    const remaining = pendingIds.filter((id) => id !== fileId);
    const { error: editError } = await admin
      .from("residence_profile_edits")
      .update(remaining.length > 0 ? { new_value: { fileIds: remaining } } : { status: "cancelled_by_residence" })
      .eq("id", pendingEdit.id as string);
    if (editError) console.error("[photo-delete] revisión pendiente:", editError.message);
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: access.actorRole,
    action: "residence_photo_deleted",
    entityType: "residences",
    entityId: residenceId,
    newValue: { file_id: fileId, was_status: file.status },
  });
  revalidatePath(`/residence/${residenceId}/profile`);
  return { status: "success" };
}
