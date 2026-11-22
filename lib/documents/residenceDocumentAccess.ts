import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import type { ResidenceActorRole, ResidencePermission } from "@/lib/residences/permissions";

/**
 * DR48 (docs/00 §31, reemplaza DR38 punto 5): una residencia abre los documentos que el estudiante subió a su perfil.
 *
 * Alcance — SIEMPRE derivado de la base, nunca de lo que mande el cliente:
 *  - Residente: estadía vigente (`resident_stays.is_current`) del estudiante en ESA residencia → casillero `residents.manage`.
 *  - Solicitante: solicitud del estudiante a ESA residencia con el pago a la residencia habilitado (docs/04 §5.2/§5.4):
 *    `residence_payment_pending` o `residence_payment_reported`, o `converted_to_reservation` mientras la reserva siga viva
 *    (fee pendiente / en proceso / fallido, o confirmada). → casillero `payments.residence`.
 *  El dueño siempre pasa (todos los casilleros); el staff, solo con el casillero del vínculo que corresponde.
 *
 * Solo archivos del bucket `student-documents` colgados de `student_profiles` con un tipo de documento de la estadía. Falla
 * cerrado y con un único mensaje para «no existe» / «no es de un estudiante vinculado» (no se filtra la existencia de archivos
 * ajenos). Cada apertura se registra en `residence_document_access_log` ANTES de generar el link: si el registro falla, no hay link.
 */

export const STUDENT_DOCUMENTS_BUCKET = "student-documents";
/** LEG-003 (2026-11-22): `student_criminal_record` ya no se abre desde la residencia; los archivos viejos quedan sin acceso. */
export const RESIDENCE_DOCUMENT_TYPES = ["student_identity", "student_academic_proof", "other"] as const;
/** Solicitud con el pago a la residencia habilitado y todavía sin reserva (docs/04 §5.2). */
export const PAYMENT_ENABLED_APPLICATION_STATUSES = ["residence_payment_pending", "residence_payment_reported"] as const;
/** Reserva nacida de la solicitud que todavía sigue viva (docs/04 §7.2): cubre el tramo hasta que se crea la estadía. */
export const LIVE_RESERVATION_STATUSES = [
  "pending_estured_fee",
  "estured_fee_processing",
  "estured_fee_failed",
  "confirmed",
  "receipt_pending",
  "receipt_issued",
] as const;
export const SIGNED_URL_SECONDS = 300;

export const DOCUMENT_NOT_AVAILABLE_MESSAGE = "No encontramos ese documento o no tenés acceso a verlo.";
export const DOCUMENT_CHECK_FAILED_MESSAGE = "No pudimos verificar el acceso al documento. Probá de nuevo en un rato.";
export const DOCUMENT_LOG_FAILED_MESSAGE = "No pudimos registrar la apertura del documento. Probá de nuevo.";
export const DOCUMENT_LINK_FAILED_MESSAGE = "No pudimos abrir el documento. Probá de nuevo en un rato.";
export const DOCUMENT_RESIDENCE_INACTIVE_MESSAGE = "La residencia no está activa en este momento, así que no podés ver documentos de solicitantes.";
export const DOCUMENT_PERMISSION_MESSAGE = "Tu usuario no tiene permiso para ver los documentos de esta persona. Pedíselo al dueño de la residencia.";

/** ¿La solicitud (con su reserva, si tiene) habilita ver los documentos del solicitante? Lógica pura, la usan la acción y la UI. */
export function applicationAllowsDocuments(applicationStatus: string, reservationStatus: string | null | undefined): boolean {
  if ((PAYMENT_ENABLED_APPLICATION_STATUSES as readonly string[]).includes(applicationStatus)) return true;
  if (applicationStatus === "converted_to_reservation") {
    return !!reservationStatus && (LIVE_RESERVATION_STATUSES as readonly string[]).includes(reservationStatus);
  }
  return false;
}

export type ResidenceDocumentBasis = { kind: "resident" } | { kind: "applicant"; applicationRequestId: string };

/** Vínculos del estudiante con ESA residencia que habilitan ver documentos. `readFailed` → fallar cerrado. */
export async function findDocumentBases(
  admin: SupabaseClient,
  residenceId: string,
  studentProfileId: string,
): Promise<{ bases: ResidenceDocumentBasis[]; readFailed: boolean }> {
  const bases: ResidenceDocumentBasis[] = [];
  const [stays, apps] = await Promise.all([
    admin
      .from("resident_stays")
      .select("id")
      .eq("residence_id", residenceId)
      .eq("student_profile_id", studentProfileId)
      .eq("is_current", true)
      .limit(1),
    admin
      .from("application_requests")
      .select("id, status")
      .eq("residence_id", residenceId)
      .eq("student_profile_id", studentProfileId)
      .in("status", [...PAYMENT_ENABLED_APPLICATION_STATUSES, "converted_to_reservation"]),
  ]);
  if (stays.error || apps.error) {
    console.error("[residence-documents] lectura de vínculos falló:", stays.error?.code ?? apps.error?.code);
    return { bases: [], readFailed: true };
  }
  if ((stays.data ?? []).length > 0) bases.push({ kind: "resident" });

  const appRows = (apps.data ?? []) as { id: string; status: string }[];
  const convertedIds = appRows.filter((a) => a.status === "converted_to_reservation").map((a) => a.id);
  const reservationByApp = new Map<string, string>();
  if (convertedIds.length > 0) {
    const { data: reservations, error } = await admin
      .from("reservations")
      .select("application_request_id, status")
      .eq("residence_id", residenceId)
      .in("application_request_id", convertedIds);
    if (error) {
      console.error("[residence-documents] lectura de reservas falló:", error.code);
      return { bases: [], readFailed: true };
    }
    for (const r of (reservations ?? []) as { application_request_id: string; status: string }[]) {
      reservationByApp.set(r.application_request_id, r.status);
    }
  }
  for (const a of appRows) {
    if (applicationAllowsDocuments(a.status, reservationByApp.get(a.id))) bases.push({ kind: "applicant", applicationRequestId: a.id });
  }
  return { bases, readFailed: false };
}

const PERMISSION_BY_BASIS: Record<ResidenceDocumentBasis["kind"], ResidencePermission> = {
  resident: "residents.manage",
  applicant: "payments.residence",
};

export type ResidenceDocumentAccessResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Autoriza, registra y firma. Recibe solo el usuario de la sesión y los ids que mandó la pantalla; todo lo demás se lee de la base.
 */
export async function grantResidenceDocumentAccess(
  admin: SupabaseClient,
  input: { userId: string; residenceId: string; fileId: string },
): Promise<ResidenceDocumentAccessResult> {
  const { userId, residenceId, fileId } = input;

  // 1. Vínculo con la residencia (sin vínculo no se lee nada del archivo). Acá solo importa distinguir «sin vínculo» de «no se
  //    pudo leer»: el casillero real se exige en el paso 4 según el vínculo del estudiante.
  const access = await assertResidencePermission(admin, userId, residenceId, "residents.manage");
  if (!access.ok && access.reason !== "no_permission") return { ok: false, error: access.error };

  // 2. El archivo: privado, de un perfil de estudiante y de un tipo de la documentación de la estadía.
  const { data: file, error: fileError } = await admin
    .from("files")
    .select("id, bucket, storage_path, related_entity_type, related_entity_id, document_type")
    .eq("id", fileId)
    .maybeSingle();
  if (fileError) {
    console.error("[residence-documents] lectura del archivo falló:", fileError.code);
    return { ok: false, error: DOCUMENT_CHECK_FAILED_MESSAGE };
  }
  const row = file as {
    id: string;
    bucket: string;
    storage_path: string;
    related_entity_type: string;
    related_entity_id: string | null;
    document_type: string;
  } | null;
  if (
    !row ||
    row.bucket !== STUDENT_DOCUMENTS_BUCKET ||
    row.related_entity_type !== "student_profiles" ||
    !row.related_entity_id ||
    !(RESIDENCE_DOCUMENT_TYPES as readonly string[]).includes(row.document_type)
  ) {
    return { ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE };
  }
  const studentProfileId = row.related_entity_id;

  // 3. Vínculo del estudiante con ESA residencia.
  const found = await findDocumentBases(admin, residenceId, studentProfileId);
  const readFailed = found.readFailed;
  let bases = found.bases;
  if (readFailed) return { ok: false, error: DOCUMENT_CHECK_FAILED_MESSAGE };
  if (bases.length === 0) return { ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE };

  // 3b. Decisión del dueño (2026-11-15): una residencia que no está activa (pausada, suspendida, con verificación rechazada o vencida,
  //     archivada) no abre documentos de SOLICITANTES. Los residentes actuales no se ven afectados. Falla cerrado.
  if (bases.some((b) => b.kind === "applicant")) {
    const { data: residenceRow, error: residenceError } = await admin.from("residences").select("status").eq("id", residenceId).maybeSingle();
    if (residenceError) {
      console.error("[residence-documents] lectura del estado de la residencia falló:", residenceError.code);
      return { ok: false, error: DOCUMENT_CHECK_FAILED_MESSAGE };
    }
    if ((residenceRow as { status: string } | null)?.status !== "verified_active") {
      bases = bases.filter((b) => b.kind !== "applicant");
      if (bases.length === 0) return { ok: false, error: DOCUMENT_RESIDENCE_INACTIVE_MESSAGE };
    }
  }

  // 4. Casillero del staff según el vínculo (el dueño pasa siempre). Si hay varios vínculos alcanza con uno permitido.
  let granted: { basis: ResidenceDocumentBasis; actorRole: ResidenceActorRole } | null = null;
  for (const basis of bases) {
    const check = await assertResidencePermission(admin, userId, residenceId, PERMISSION_BY_BASIS[basis.kind]);
    if (check.ok) {
      granted = { basis, actorRole: check.actorRole };
      break;
    }
    if (check.reason !== "no_permission") return { ok: false, error: check.error };
  }
  if (!granted) return { ok: false, error: DOCUMENT_PERMISSION_MESSAGE };

  // 5. Registro ANTES del link: sin registro no hay link.
  const { error: logError } = await admin.from("residence_document_access_log").insert({
    file_id: row.id,
    document_type: row.document_type,
    student_profile_id: studentProfileId,
    residence_id: residenceId,
    user_id: userId,
    actor_role: granted.actorRole,
    access_basis: granted.basis.kind,
    application_request_id: granted.basis.kind === "applicant" ? granted.basis.applicationRequestId : null,
  });
  if (logError) {
    console.error("[residence-documents] registro de apertura falló:", logError.code);
    return { ok: false, error: DOCUMENT_LOG_FAILED_MESSAGE };
  }

  await createAuditLog(admin, {
    actorUserId: userId,
    actorRole: granted.actorRole,
    action: "residence_document_accessed",
    entityType: "files",
    entityId: row.id,
    newValue: {
      residence_id: residenceId,
      student_profile_id: studentProfileId,
      document_type: row.document_type,
      access_basis: granted.basis.kind,
      ...(granted.basis.kind === "applicant" ? { application_request_id: granted.basis.applicationRequestId } : {}),
    },
    source: "user",
  });

  // 6. Link firmado corto.
  const { data: signed, error: signError } = await admin.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
  if (signError || !signed?.signedUrl) {
    console.error("[residence-documents] no se pudo firmar el link:", signError?.message ?? "sin url");
    return { ok: false, error: DOCUMENT_LINK_FAILED_MESSAGE };
  }
  return { ok: true, url: signed.signedUrl };
}
