import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { extensionForMime, resolveEvidenceType, toTypedBlob } from "@/lib/files/sniffFile";
import { safeFilename } from "@/lib/files/safeFilename";
import { consumeRateLimit } from "@/lib/security/rateLimit";

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

async function validateEvidence(files: File[]): Promise<string | null> {
  for (const file of files) {
    if (file.size > MAX_EVIDENCE_BYTES) return `${file.name} supera los 25MB permitidos.`;
    // El MIME lo declara el cliente: además se comprueba el contenido real (firma del archivo).
    if (!ALLOWED_EVIDENCE_TYPES.includes(file.type) || !(await resolveEvidenceType(file, file.type))) {
      return `${file.name}: tipo de archivo no permitido (PDF, foto, video o audio).`;
    }
  }
  return null;
}

async function uploadEvidence(admin: SupabaseClient, supportCaseId: string, actorUserId: string, files: File[]) {
  for (const file of files) {
    const realType = await resolveEvidenceType(file, file.type);
    if (!realType) continue; // ya validado antes de abrir el caso; defensa extra
    const ext = extensionForMime(realType);
    const path = `${supportCaseId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("support-evidence")
      .upload(path, await toTypedBlob(file, realType), { contentType: realType });
    if (uploadError) {
      console.error("[support] evidence upload failed:", uploadError);
      continue;
    }
    const { error: fileInsertError } = await admin.from("files").insert({
      owner_user_id: actorUserId,
      related_entity_type: "support_cases",
      related_entity_id: supportCaseId,
      bucket: "support-evidence",
      storage_path: path,
      filename: safeFilename(file.name),
      mime_type: realType,
      size_bytes: file.size,
      visibility: "context_shared",
      document_type: "support_case_evidence",
      status: "uploaded",
      uploaded_by_user_id: actorUserId,
    });
    if (fileInsertError) {
      console.error("[support] evidence file row failed:", fileInsertError);
      // El archivo quedó sin registro: se limpia el objeto huérfano (mejor esfuerzo).
      await admin.storage.from("support-evidence").remove([path]);
    }
  }
}

const CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];

/**
 * SEG15-02: tope por usuario para abrir casos de soporte. Tres frenos, todos antes de crear nada:
 *  - ritmo: máximo 5 casos por hora (`consumeRateLimit`, atómico entre instancias);
 *  - casos abiertos a la vez: máximo 10 sin cerrar;
 *  - evidencia: máximo 100 MB subidos en 24 horas (los 25 MB por archivo ya se validan aparte).
 * Si no se puede medir la cuota, falla cerrado.
 */
export const SUPPORT_MAX_CASES_PER_HOUR = 5;
export const SUPPORT_MAX_OPEN_CASES = 10;
export const SUPPORT_MAX_EVIDENCE_BYTES_PER_DAY = 100 * 1024 * 1024;
const SUPPORT_QUOTA_MESSAGE = "Abriste muchos casos en poco tiempo. Esperá un rato o sumá el detalle a un caso que ya tengas abierto.";
const SUPPORT_OPEN_CAP_MESSAGE = "Ya tenés varios casos abiertos. Esperá a que cerremos alguno antes de abrir otro.";
const SUPPORT_EVIDENCE_QUOTA_MESSAGE = "Alcanzaste el límite de archivos que podés adjuntar por hoy. Probá de nuevo mañana.";
const SUPPORT_CHECK_FAILED = "No pudimos abrir el caso. Probá de nuevo en un rato.";

async function assertSupportQuota(admin: SupabaseClient, userId: string, files: File[]): Promise<string | null> {
  const open = await admin.from("support_cases").select("status").eq("opened_by_user_id", userId);
  if (open.error) {
    console.error("[support] cuota de casos abiertos falló:", open.error.code);
    return SUPPORT_CHECK_FAILED;
  }
  const openCount = (open.data ?? []).filter((c) => !CLOSED_STATUSES.includes((c as { status: string }).status)).length;
  if (openCount >= SUPPORT_MAX_OPEN_CASES) return SUPPORT_OPEN_CAP_MESSAGE;

  const incoming = files.reduce((sum, f) => sum + f.size, 0);
  if (incoming > 0) {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const used = await admin.from("files").select("size_bytes, created_at").eq("bucket", "support-evidence").eq("uploaded_by_user_id", userId);
    if (used.error) {
      console.error("[support] cuota de evidencia falló:", used.error.code);
      return SUPPORT_CHECK_FAILED;
    }
    const total = (used.data ?? [])
      .filter((r) => new Date((r as { created_at: string }).created_at).getTime() >= since)
      .reduce((sum, r) => sum + Number((r as { size_bytes: number | null }).size_bytes ?? 0), 0);
    if (total + incoming > SUPPORT_MAX_EVIDENCE_BYTES_PER_DAY) return SUPPORT_EVIDENCE_QUOTA_MESSAGE;
  }

  // Al final: solo consume ritmo un intento que ya pasó los demás chequeos.
  const rate = await consumeRateLimit({ bucket: "support_open_user", key: userId, windowSeconds: 60 * 60, max: SUPPORT_MAX_CASES_PER_HOUR }, admin);
  if (!rate.ok) return SUPPORT_QUOTA_MESSAGE;
  return null;
}

/** Tope de la descripción de un caso (también CHECK en la base, migración 0084). */
const MAX_DESCRIPTION_CHARS = 5000;
const DESCRIPTION_TOO_LONG = `La descripción es demasiado larga (máximo ${MAX_DESCRIPTION_CHARS} caracteres). Resumila y adjuntá el detalle como evidencia.`;

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
  if (description.length > MAX_DESCRIPTION_CHARS) return { ok: false, error: DESCRIPTION_TOO_LONG };
  if (!params.termsReminderAccepted) {
    return { ok: false, error: "Tenés que confirmar que leíste el alcance y los términos antes de continuar." };
  }

  const { data: residence } = await admin.from("residences").select("id").eq("id", params.residenceId).maybeSingle();
  if (!residence) return { ok: false, error: "No encontramos esa residencia." };

  const evidenceError = await validateEvidence(params.evidenceFiles);
  if (evidenceError) return { ok: false, error: evidenceError };

  const quotaError = await assertSupportQuota(admin, params.actorUserId, params.evidenceFiles);
  if (quotaError) return { ok: false, error: quotaError };

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
  if (description.length > MAX_DESCRIPTION_CHARS) return { ok: false, error: DESCRIPTION_TOO_LONG };
  const evidenceError = await validateEvidence(params.evidenceFiles);
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

  const quotaError = await assertSupportQuota(admin, params.actorUserId, params.evidenceFiles);
  if (quotaError) return { ok: false, error: quotaError };

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
