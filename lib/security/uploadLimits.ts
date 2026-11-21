import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeRateLimit } from "@/lib/security/rateLimit";

/**
 * Límites de subida de comprobantes (auditoría de costos 2026-11-21, C4). Además del tope por archivo (10 MB), acota cuántas veces
 * puede subir una persona y cuántos comprobantes se acumulan por solicitud: cada reemplazo deja el archivo anterior en Storage.
 */
export const PROOF_UPLOADS_PER_HOUR = 10;
export const MAX_PROOF_FILES_PER_APPLICATION = 10;
export const PROOF_UPLOAD_LIMIT_MESSAGE = "Hiciste muchas cargas de comprobantes. Probá de nuevo en un rato o escribinos desde Soporte.";

/** Subidas de comprobante por usuario y hora (persistente, cuenta entre instancias). */
export async function proofUploadAllowed(admin: SupabaseClient, userId: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "proof_upload_user", key: userId, windowSeconds: 3_600, max: PROOF_UPLOADS_PER_HOUR }, admin)).ok;
}

/** `false` si la solicitud ya acumuló el máximo de comprobantes del estudiante. Si la lectura falla, deja pasar (el tope por hora sigue vigente). */
export async function proofCountWithinCap(admin: SupabaseClient, applicationId: string): Promise<boolean> {
  const { count, error } = await admin
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("related_entity_type", "application_requests")
    .eq("related_entity_id", applicationId)
    .eq("document_type", "student_payment_proof_to_residence");
  if (error) {
    console.error("[uploadLimits] no se pudo contar comprobantes:", error.message);
    return true;
  }
  return (count ?? 0) < MAX_PROOF_FILES_PER_APPLICATION;
}
