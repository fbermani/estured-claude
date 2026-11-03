import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STAY_DOCUMENTS_SECTION,
  listStayRequirements,
  parseStayDocumentsContent,
  restrictToLegacyRequirements,
  type StayDocumentsConfig,
  type StayRequirement,
  type StudentDocumentFile,
} from "@/lib/residences/stayDocuments";

/** Archivo de un estudiante tal como lo leen las pantallas de DR38 (el `id` y el nombre solo los usa el propio estudiante). */
export type StudentDocumentRow = StudentDocumentFile & {
  id: string;
  filename: string;
  student_profile_id: string;
  created_at: string;
};

const LEGACY_TYPES = ["student_identity", "student_academic_proof", "other"];

/**
 * Archivos de documentación de uno o varios perfiles de estudiante.
 *
 * `schemaReady` es false cuando la migración 0077 no está aplicada (falla el valor nuevo del enum o la columna
 * `requirement_label`): en ese caso se devuelve lo de siempre (identidad, estudios y «otros») y las pantallas piden solo eso.
 * Nunca lanza.
 */
export async function loadStudentDocumentFiles(
  admin: SupabaseClient,
  studentProfileIds: string[],
): Promise<{ files: StudentDocumentRow[]; schemaReady: boolean }> {
  if (studentProfileIds.length === 0) return { files: [], schemaReady: true };
  const full = await admin
    .from("files")
    .select("id, filename, document_type, requirement_label, created_at, related_entity_id")
    .eq("related_entity_type", "student_profiles")
    .in("related_entity_id", studentProfileIds)
    .in("document_type", [...LEGACY_TYPES, "student_criminal_record"]);
  if (!full.error) return { files: toRows(full.data), schemaReady: true };

  const legacy = await admin
    .from("files")
    .select("id, filename, document_type, created_at, related_entity_id")
    .eq("related_entity_type", "student_profiles")
    .in("related_entity_id", studentProfileIds)
    .in("document_type", LEGACY_TYPES);
  if (legacy.error) {
    console.error("[stayDocuments] lectura de archivos falló:", legacy.error);
    return { files: [], schemaReady: false };
  }
  return { files: toRows(legacy.data), schemaReady: false };
}

function toRows(data: unknown): StudentDocumentRow[] {
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    filename: String(r.filename ?? ""),
    document_type: String(r.document_type),
    requirement_label: (r.requirement_label as string | null | undefined) ?? null,
    created_at: String(r.created_at ?? ""),
    student_profile_id: String(r.related_entity_id),
  }));
}

/** Configuración guardada de la residencia (default si no hay sección o falla la lectura). */
export async function loadStayDocumentsConfig(admin: SupabaseClient, residenceId: string): Promise<StayDocumentsConfig> {
  const { data, error } = await admin
    .from("residence_profile_sections")
    .select("content")
    .eq("residence_id", residenceId)
    .eq("section_type", STAY_DOCUMENTS_SECTION)
    .maybeSingle();
  if (error) console.error("[stayDocuments] lectura de la configuración falló:", error);
  return parseStayDocumentsContent(error ? null : data?.content);
}

/** Requisitos efectivos: los de la residencia, recortados a los de siempre si la migración 0077 no está aplicada. */
export function effectiveRequirements(config: StayDocumentsConfig, schemaReady: boolean): StayRequirement[] {
  const all = listStayRequirements(config);
  return schemaReady ? all : restrictToLegacyRequirements(all);
}
