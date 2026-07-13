import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type OpenSupportCaseResult = { ok: true; supportCaseId: string } | { ok: false; error: string };

const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
];

/**
 * Abrir un caso de soporte (docs/12 Fase 14, docs/03 §22). Puede
 * abrirlo: estudiante, familiar vinculado, residence_owner/staff, admin
 * (docs/05 §17.1) — acá se valida solo que el actor tenga alguna
 * relación con la residencia (student_profile o residence_users activo),
 * sin distinguir más el rol, ya que el motivo puede ser sobre cualquier
 * interacción con esa residencia.
 *
 * `termsReminderAccepted` es obligatorio (docs/03 §22.1: recordatorio de
 * términos, alcance y deslinde de responsabilidad antes de abrir).
 * Evidencia (docs/03 §22.2: fotos/videos/capturas/audios) es opcional,
 * puede agregarse después vía `attachSupportCaseEvidence`.
 */
export async function openSupportCase(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    actorRole: string;
    residenceId: string;
    description: string;
    termsReminderAccepted: boolean;
    relatedEntityType?: string;
    relatedEntityId?: string;
    evidenceFiles: File[];
  },
): Promise<OpenSupportCaseResult> {
  const description = params.description.trim();
  if (description.length < 20) {
    return { ok: false, error: "Contanos un poco más — el detalle debe tener al menos 20 caracteres." };
  }
  if (!params.termsReminderAccepted) {
    return { ok: false, error: "Tenés que confirmar que leíste el alcance y los términos antes de continuar." };
  }

  const { data: residence } = await admin.from("residences").select("id").eq("id", params.residenceId).maybeSingle();
  if (!residence) return { ok: false, error: "No encontramos esa residencia." };

  for (const file of params.evidenceFiles) {
    if (file.size > MAX_EVIDENCE_BYTES) return { ok: false, error: `${file.name} supera los 25MB permitidos.` };
    if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
      return { ok: false, error: `${file.name}: tipo de archivo no permitido (PDF, foto, video o audio).` };
    }
  }

  const { data: supportCase, error } = await admin
    .from("support_cases")
    .insert({
      opened_by_user_id: params.actorUserId,
      opened_by_role: params.actorRole,
      residence_id: params.residenceId,
      related_entity_type: params.relatedEntityType ?? null,
      related_entity_id: params.relatedEntityId ?? null,
      description,
      terms_reminder_accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !supportCase) {
    console.error("[support] openSupportCase insert failed:", error);
    return { ok: false, error: "No pudimos abrir el caso. Probá de nuevo." };
  }

  for (const file of params.evidenceFiles) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : file.type.split("/")[1];
    const path = `${supportCase.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("support-evidence")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      console.error("[support] evidence upload failed:", uploadError);
      continue;
    }
    await admin.from("files").insert({
      owner_user_id: params.actorUserId,
      related_entity_type: "support_cases",
      related_entity_id: supportCase.id,
      bucket: "support-evidence",
      storage_path: path,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      visibility: "context_shared",
      document_type: "support_case_evidence",
      status: "uploaded",
      uploaded_by_user_id: params.actorUserId,
    });
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "support_case_opened",
    entityType: "support_cases",
    entityId: supportCase.id,
    source: "user",
  });

  return { ok: true, supportCaseId: supportCase.id };
}
