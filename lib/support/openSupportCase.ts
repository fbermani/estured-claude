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

function validateEvidence(files: File[]): string | null {
  for (const file of files) {
    if (file.size > MAX_EVIDENCE_BYTES) return `${file.name} supera los 25MB permitidos.`;
    if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
      return `${file.name}: tipo de archivo no permitido (PDF, foto, video o audio).`;
    }
  }
  return null;
}

async function uploadEvidence(admin: SupabaseClient, supportCaseId: string, actorUserId: string, files: File[]) {
  for (const file of files) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : file.type.split("/")[1];
    const path = `${supportCaseId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("support-evidence")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      console.error("[support] evidence upload failed:", uploadError);
      continue;
    }
    await admin.from("files").insert({
      owner_user_id: actorUserId,
      related_entity_type: "support_cases",
      related_entity_id: supportCaseId,
      bucket: "support-evidence",
      storage_path: path,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      visibility: "context_shared",
      document_type: "support_case_evidence",
      status: "uploaded",
      uploaded_by_user_id: actorUserId,
    });
  }
}

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

  const evidenceError = validateEvidence(params.evidenceFiles);
  if (evidenceError) return { ok: false, error: evidenceError };

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

  await uploadEvidence(admin, supportCase.id, params.actorUserId, params.evidenceFiles);

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

type FeeReservationAccess = { reservationId: string; residenceName: string | null };

/**
 * La reserva solo es accesible para el pagador designado de su fee o para el
 * estudiante beneficiario. Devuelve `null` si no existe o no corresponde.
 */
async function resolveFeeReservationAccess(
  admin: SupabaseClient,
  userId: string,
  reservationId: string,
): Promise<FeeReservationAccess | null> {
  const { data: reservation } = await admin
    .from("reservations")
    .select("id, student_profile_id, estured_fee_payment_id, residences(name)")
    .eq("id", reservationId)
    .maybeSingle();
  if (!reservation?.estured_fee_payment_id) return null;

  const { data: fee } = await admin
    .from("estured_fee_payments")
    .select("payer_user_id")
    .eq("id", reservation.estured_fee_payment_id)
    .maybeSingle();
  let allowed = fee?.payer_user_id === userId;
  if (!allowed) {
    const { data: student } = await admin
      .from("student_profiles")
      .select("user_id")
      .eq("id", reservation.student_profile_id)
      .maybeSingle();
    allowed = student?.user_id === userId;
  }
  if (!allowed) return null;
  return {
    reservationId: reservation.id as string,
    residenceName: (reservation.residences as unknown as { name: string } | null)?.name ?? null,
  };
}

/** Contexto para precargar el formulario de "problema con el pago" (o `null` si la reserva no es del usuario). */
export async function loadFeeSupportContext(admin: SupabaseClient, userId: string, reservationId: string) {
  return resolveFeeReservationAccess(admin, userId, reservationId);
}

const CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];

/**
 * Caso "problema con el pago del fee" (D2 / H02): el fee lo cobra EstuRed, no
 * la residencia, así que el caso va dirigido a EstuRed — sin residencia y sin
 * el recordatorio de deslinde de los reclamos (migración 0040, `topic =
 * 'estured_fee_payment'`). Lo puede abrir el pagador designado del fee o el
 * estudiante beneficiario. El contexto es la reserva. Mismos estados y mismo
 * panel admin que cualquier caso; abrirlo no suspende ni confirma nada.
 */
export async function openFeePaymentSupportCase(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    actorRole: string;
    reservationId: string;
    description: string;
    evidenceFiles: File[];
  },
): Promise<OpenSupportCaseResult> {
  const description = params.description.trim();
  if (description.length < 20) {
    return { ok: false, error: "Contanos un poco más — el detalle debe tener al menos 20 caracteres." };
  }
  const evidenceError = validateEvidence(params.evidenceFiles);
  if (evidenceError) return { ok: false, error: evidenceError };

  const access = await resolveFeeReservationAccess(admin, params.actorUserId, params.reservationId);
  if (!access) return { ok: false, error: "No encontramos esa reserva o no te pertenece." };
  const reservation = { id: access.reservationId };

  const { data: openCases } = await admin
    .from("support_cases")
    .select("id, status")
    .eq("topic", "estured_fee_payment")
    .eq("related_entity_id", reservation.id)
    .eq("opened_by_user_id", params.actorUserId);
  if ((openCases ?? []).some((c) => !CLOSED_STATUSES.includes(c.status as string))) {
    return { ok: false, error: "Ya tenés un caso abierto por el pago de esta reserva. Lo ves abajo, en \"Tus casos\"." };
  }

  const { data: supportCase, error } = await admin
    .from("support_cases")
    .insert({
      opened_by_user_id: params.actorUserId,
      opened_by_role: params.actorRole,
      topic: "estured_fee_payment",
      residence_id: null,
      related_entity_type: "reservations",
      related_entity_id: reservation.id,
      description,
      terms_reminder_accepted_at: null,
    })
    .select("id")
    .single();
  if (error || !supportCase) {
    console.error("[support] openFeePaymentSupportCase insert failed:", error);
    return { ok: false, error: "No pudimos enviar tu consulta. Probá de nuevo." };
  }

  await uploadEvidence(admin, supportCase.id, params.actorUserId, params.evidenceFiles);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "support_case_opened",
    entityType: "support_cases",
    entityId: supportCase.id,
    newValue: { topic: "estured_fee_payment", reservation_id: reservation.id },
    source: "user",
  });

  return { ok: true, supportCaseId: supportCase.id };
}
