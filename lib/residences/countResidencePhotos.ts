import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cantidad de fotos propias *aprobadas* de una residencia: las mismas que
 * ve el público en la ficha (`files` con `document_type = 'residence_photo'`
 * y `status = 'approved'`). Las pendientes de revisión o rechazadas no
 * cuentan para el mínimo de publicación (Ciclo 54, D12).
 *
 * Ante un error de lectura devuelve `null` (no se asume 0 ni se asume que
 * alcanza): quien llama decide cómo frenar.
 */
export async function countResidencePhotos(admin: SupabaseClient, residenceId: string): Promise<number | null> {
  const { count, error } = await admin
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("related_entity_type", "residences")
    .eq("related_entity_id", residenceId)
    .eq("document_type", "residence_photo")
    .eq("status", "approved");
  if (error) {
    console.error("[fotos] no se pudo contar las fotos de la residencia:", error);
    return null;
  }
  return count ?? 0;
}
