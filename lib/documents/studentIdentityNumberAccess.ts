import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import type { ResidenceActorRole, ResidencePermission } from "@/lib/residences/permissions";
import {
  DOCUMENT_CHECK_FAILED_MESSAGE,
  DOCUMENT_LOG_FAILED_MESSAGE,
  DOCUMENT_NOT_AVAILABLE_MESSAGE,
  DOCUMENT_PERMISSION_MESSAGE,
  DOCUMENT_RESIDENCE_INACTIVE_MESSAGE,
} from "@/lib/documents/residenceDocumentAccess";
import { isIdentityDocumentType, type IdentityDocumentType } from "@/lib/students/identityDocument";

/**
 * DR58 fase 2 (docs/00 §31, docs/10 §6.4): la residencia lee el número de documento del estudiante.
 *
 * Supuesto reversible, MÁS ESTRICTO que el archivo (DR48): el número solo se ve con una estadía vigente de ESE estudiante en
 * ESA residencia, o con una reserva ya CONFIRMADA nacida de su solicitud a ESA residencia. Nunca antes (solicitud, pago a la
 * residencia habilitado o fee pendiente), nunca de otra residencia. Para volver al alcance de DR48 alcanza con ampliar
 * `IDENTITY_NUMBER_RESERVATION_STATUSES`.
 *
 * Lectura solo en el servidor, con service role, por pedido explícito (nunca viaja en listados ni en la carga de la pantalla).
 * Cada lectura se registra en `residence_document_access_log` ANTES de devolver el número (`document_type = 'identity_number'`,
 * sin archivo): si el registro falla, no hay número. El registro y la auditoría NO guardan el número (docs/10 §10.6).
 */

export const IDENTITY_NUMBER_LOG_TYPE = "identity_number";
/** Reserva confirmada (docs/04 §7.2): el fee ya se pagó y la reserva sigue en pie. */
export const IDENTITY_NUMBER_RESERVATION_STATUSES = ["confirmed", "receipt_pending", "receipt_issued"] as const;

export const IDENTITY_NUMBER_NOT_LOADED_MESSAGE = "Todavía no cargó su documento de identidad.";

/** ¿La solicitud, ya convertida en reserva, habilita ver el número? Lógica pura, la usan la acción y la pantalla. */
export function applicationAllowsIdentityNumber(applicationStatus: string, reservationStatus: string | null | undefined): boolean {
  return (
    applicationStatus === "converted_to_reservation" &&
    !!reservationStatus &&
    (IDENTITY_NUMBER_RESERVATION_STATUSES as readonly string[]).includes(reservationStatus)
  );
}

type IdentityBasis = { kind: "resident" } | { kind: "applicant"; applicationRequestId: string };

async function findIdentityNumberBases(
  admin: SupabaseClient,
  residenceId: string,
  studentProfileId: string,
): Promise<{ bases: IdentityBasis[]; readFailed: boolean }> {
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
      .eq("status", "converted_to_reservation"),
  ]);
  if (stays.error || apps.error) {
    console.error("[identity-number] lectura de vínculos falló:", stays.error?.code ?? apps.error?.code);
    return { bases: [], readFailed: true };
  }
  const bases: IdentityBasis[] = [];
  if ((stays.data ?? []).length > 0) bases.push({ kind: "resident" });

  const appIds = ((apps.data ?? []) as { id: string }[]).map((a) => a.id);
  if (appIds.length > 0) {
    const { data: reservations, error } = await admin
      .from("reservations")
      .select("application_request_id, status")
      .eq("residence_id", residenceId)
      .in("application_request_id", appIds);
    if (error) {
      console.error("[identity-number] lectura de reservas falló:", error.code);
      return { bases: [], readFailed: true };
    }
    for (const r of (reservations ?? []) as { application_request_id: string; status: string }[]) {
      if (applicationAllowsIdentityNumber("converted_to_reservation", r.status)) {
        bases.push({ kind: "applicant", applicationRequestId: r.application_request_id });
      }
    }
  }
  return { bases, readFailed: false };
}

const PERMISSION_BY_BASIS: Record<IdentityBasis["kind"], ResidencePermission> = {
  resident: "residents.manage",
  applicant: "payments.residence",
};

export type StudentIdentityNumberResult =
  | { ok: true; documentType: IdentityDocumentType; number: string }
  | { ok: false; error: string };

/** Autoriza, registra y devuelve el número. Solo recibe usuario de la sesión y ids de la pantalla; el resto sale de la base. */
export async function grantStudentIdentityNumberAccess(
  admin: SupabaseClient,
  input: { userId: string; residenceId: string; studentProfileId: string },
): Promise<StudentIdentityNumberResult> {
  const { userId, residenceId, studentProfileId } = input;

  // 1. Vínculo del usuario con la residencia (el casillero real se exige en el paso 4 según el vínculo del estudiante).
  const access = await assertResidencePermission(admin, userId, residenceId, "residents.manage");
  if (!access.ok && access.reason !== "no_permission") return { ok: false, error: access.error };

  // 2. Vínculo del estudiante con ESA residencia.
  const found = await findIdentityNumberBases(admin, residenceId, studentProfileId);
  if (found.readFailed) return { ok: false, error: DOCUMENT_CHECK_FAILED_MESSAGE };
  let bases = found.bases;
  if (bases.length === 0) return { ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE };

  // 3. Residencia no activa: no se ve el número de solicitantes (igual que DR48); los residentes actuales no cambian.
  if (bases.some((b) => b.kind === "applicant")) {
    const { data: residenceRow, error: residenceError } = await admin.from("residences").select("status").eq("id", residenceId).maybeSingle();
    if (residenceError) {
      console.error("[identity-number] lectura del estado de la residencia falló:", residenceError.code);
      return { ok: false, error: DOCUMENT_CHECK_FAILED_MESSAGE };
    }
    if ((residenceRow as { status: string } | null)?.status !== "verified_active") {
      bases = bases.filter((b) => b.kind !== "applicant");
      if (bases.length === 0) return { ok: false, error: DOCUMENT_RESIDENCE_INACTIVE_MESSAGE };
    }
  }

  // 4. Casillero según el vínculo (el dueño pasa siempre).
  let granted: { basis: IdentityBasis; actorRole: ResidenceActorRole } | null = null;
  for (const basis of bases) {
    const check = await assertResidencePermission(admin, userId, residenceId, PERMISSION_BY_BASIS[basis.kind]);
    if (check.ok) {
      granted = { basis, actorRole: check.actorRole };
      break;
    }
    if (check.reason !== "no_permission") return { ok: false, error: check.error };
  }
  if (!granted) return { ok: false, error: DOCUMENT_PERMISSION_MESSAGE };

  // 5. El dato (tabla privada, solo service role).
  const { data: identity, error: identityError } = await admin
    .from("student_identity_documents")
    .select("document_type, document_number")
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  if (identityError) {
    console.error("[identity-number] lectura del documento falló:", identityError.code);
    return { ok: false, error: DOCUMENT_CHECK_FAILED_MESSAGE };
  }
  const row = identity as { document_type: string; document_number: string } | null;
  if (!row || !isIdentityDocumentType(row.document_type)) return { ok: false, error: IDENTITY_NUMBER_NOT_LOADED_MESSAGE };

  // 6. Registro ANTES de devolver el número: sin registro no hay número. Nunca guarda el número.
  const { error: logError } = await admin.from("residence_document_access_log").insert({
    file_id: null,
    document_type: IDENTITY_NUMBER_LOG_TYPE,
    student_profile_id: studentProfileId,
    residence_id: residenceId,
    user_id: userId,
    actor_role: granted.actorRole,
    access_basis: granted.basis.kind,
    application_request_id: granted.basis.kind === "applicant" ? granted.basis.applicationRequestId : null,
  });
  if (logError) {
    console.error("[identity-number] registro de lectura falló:", logError.code);
    return { ok: false, error: DOCUMENT_LOG_FAILED_MESSAGE };
  }
  await createAuditLog(admin, {
    actorUserId: userId,
    actorRole: granted.actorRole,
    action: "student_identity_number_accessed",
    entityType: "student_profiles",
    entityId: studentProfileId,
    newValue: {
      residence_id: residenceId,
      document_type: row.document_type,
      access_basis: granted.basis.kind,
      ...(granted.basis.kind === "applicant" ? { application_request_id: granted.basis.applicationRequestId } : {}),
    },
    source: "user",
  });

  return { ok: true, documentType: row.document_type, number: row.document_number };
}
