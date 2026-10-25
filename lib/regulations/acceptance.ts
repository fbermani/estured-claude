import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { loadActiveFamilyLink } from "@/lib/family/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { MODEL_VERSION } from "@/lib/regulations/modelTemplate";
import { baseModelView, loadCurrentRegulation } from "@/lib/regulations/current";

/**
 * Aceptación del reglamento (DR14, docs/06 §11.5, docs/08 §4.5). Entidad separada de `/terms` y de la solicitud: no toca los estados de
 * `application_requests`. Una por solicitud. Hay dos caminos: (1) al enviar la solicitud desde la ficha (`resolveRegulationToAccept` +
 * `recordRegulationAcceptance`) y (2) después, cuando la solicitud nació sin aceptación (propuesta del familiar, lista de espera, menor,
 * o un fallo al registrarla): `acceptRegulationForApplication`. Mientras falte, la residencia no puede avanzarla (`gate.ts`).
 */

export const REGULATION_NOT_ACCEPTED_MESSAGE = "Para enviar la solicitud tenés que leer el reglamento de la residencia y aceptarlo.";
export const REGULATION_CHANGED_MESSAGE = "La residencia actualizó su reglamento mientras lo leías. Volvé a leerlo y aceptalo de nuevo para enviar la solicitud.";
export const REGULATION_UNAVAILABLE_MESSAGE = "No pudimos cargar el reglamento de la residencia. Probá de nuevo en unos minutos.";
export const REGULATION_MISSING_HASH_MESSAGE = "Recargá la página para leer el reglamento completo y aceptarlo.";

export type RegulationToAccept = {
  /** Id de la versión que se va a aceptar, o null si la migración 0053 no está aplicada (no se guarda la aceptación). */
  versionId: string | null;
  hash: string;
};

/**
 * Antes de aceptar: valida el checkbox y que se acepte la versión vigente (el hash que el estudiante vio tiene que ser el actual y es
 * OBLIGATORIO cuando el esquema está listo). Devuelve la versión a registrar. Con la migración sin aplicar no bloquea (`versionId: null`).
 */
export async function resolveRegulationToAccept(
  admin: SupabaseClient,
  params: { residenceId: string; accepted: boolean; seenHash: string | null },
): Promise<{ ok: true; regulation: RegulationToAccept } | { ok: false; error: string }> {
  if (!params.accepted) return { ok: false, error: REGULATION_NOT_ACCEPTED_MESSAGE };

  const current = await loadCurrentRegulation(admin, params.residenceId);
  if (!current.ok) return { ok: false, error: REGULATION_UNAVAILABLE_MESSAGE };
  const view = current.view;

  if (!view.schemaReady) return { ok: true, regulation: { versionId: null, hash: view.hash } };
  // Sin el hash de lo que se leyó no hay prueba de qué se aceptó: se rechaza (no se acepta "la vigente" a ciegas).
  if (!params.seenHash) return { ok: false, error: REGULATION_MISSING_HASH_MESSAGE };
  if (params.seenHash !== view.hash) return { ok: false, error: REGULATION_CHANGED_MESSAGE };

  if (view.versionId) return { ok: true, regulation: { versionId: view.versionId, hash: view.hash } };
  const ensured = await ensureModelVersion(admin, params.residenceId);
  if (!ensured.ok) return ensured;
  if (params.seenHash !== ensured.hash) return { ok: false, error: REGULATION_CHANGED_MESSAGE };
  return { ok: true, regulation: { versionId: ensured.versionId, hash: ensured.hash } };
}

/**
 * La residencia no tiene reglamento propio: la aceptación referencia una fila de versión que contiene el MODELO base (docs/06 §8.7),
 * creada una sola vez por residencia (marca `base_model`) por la función SQL `ensure_model_regulation_version`, que bloquea la residencia
 * y por eso no corre contra una publicación simultánea. Si el texto del modelo cambió y esa fila es la vigente, la reemplaza.
 */
async function ensureModelVersion(
  admin: SupabaseClient,
  residenceId: string,
): Promise<{ ok: true; versionId: string; hash: string } | { ok: false; error: string }> {
  const base = baseModelView(true);
  const { data, error } = await admin.rpc("ensure_model_regulation_version", {
    p_residence_id: residenceId,
    p_model_version: MODEL_VERSION,
    p_content: { text: base.text, base_model: true },
    p_hash: base.hash,
  });
  const row = data as { id?: string; content_hash?: string } | null;
  if (error || !row?.id || !row.content_hash) {
    if (error) console.error("[regulations] ensure model version failed:", error.code, error.message);
    return { ok: false, error: REGULATION_UNAVAILABLE_MESSAGE };
  }
  return { ok: true, versionId: row.id, hash: row.content_hash };
}

/** ¿Está aplicada la 0053 (existen las aceptaciones y la marca de pendiente)? Las rutas que crean solicitudes sin aceptación la usan para marcarlas pendientes. */
export async function regulationAcceptanceEnabled(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from("application_regulation_acceptances").select("id").limit(1);
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[regulations] schema probe failed:", error.code, error.message);
    return false;
  }
  const { error: colError } = await admin.from("application_requests").select("regulation_acceptance_pending").limit(1);
  if (colError) {
    if (!isMissingSchemaError(colError)) console.error("[regulations] pending column probe failed:", colError.code, colError.message);
    return false;
  }
  return true;
}

type AcceptActor = { userId: string; role: "student" | "guardian" };

async function insertAcceptance(
  admin: SupabaseClient,
  params: { applicationRequestId: string; residenceId: string; regulation: RegulationToAccept; actor: AcceptActor },
): Promise<boolean> {
  if (!params.regulation.versionId) return true;
  const row = {
    application_request_id: params.applicationRequestId,
    residence_id: params.residenceId,
    regulation_version_id: params.regulation.versionId,
    content_hash: params.regulation.hash,
    accepted_at: new Date().toISOString(),
    accepted_by_user_id: params.actor.userId,
    accepted_by_role: params.actor.role,
  };
  const actorRole = params.actor.role === "guardian" ? "family_member" : "student";
  let lastError: { code?: string; message?: string } | null = null;
  for (let i = 0; i < 2; i++) {
    const { error } = await admin.from("application_regulation_acceptances").insert(row);
    if (!error) {
      await createAuditLog(admin, {
        actorUserId: params.actor.userId,
        actorRole,
        action: "application_regulation_accepted",
        entityType: "application_requests",
        entityId: params.applicationRequestId,
        newValue: { residence_id: params.residenceId, regulation_version_id: params.regulation.versionId, content_hash: params.regulation.hash, accepted_by_role: params.actor.role },
      });
      return true;
    }
    if (error.code === "23505") return true; // ya estaba registrada (reintento): la primera es la válida
    if (isMissingSchemaError(error)) return true;
    lastError = error;
  }
  console.error("[regulations] acceptance insert failed:", lastError?.code, lastError?.message);
  await createAuditLog(admin, {
    actorUserId: params.actor.userId,
    actorRole,
    action: "application_regulation_acceptance_failed",
    entityType: "application_requests",
    entityId: params.applicationRequestId,
    newValue: { residence_id: params.residenceId, content_hash: params.regulation.hash },
  });
  return false;
}

async function clearPending(admin: SupabaseClient, applicationId: string): Promise<void> {
  const { error } = await admin.from("application_requests").update({ regulation_acceptance_pending: false }).eq("id", applicationId);
  // Cosmético: el bloqueo se levanta por la existencia de la fila de aceptación, no por esta marca.
  if (error && !isMissingSchemaError(error)) console.error("[regulations] clear pending failed:", error.code, error.message);
}

/**
 * Después de crear la solicitud desde la ficha: guarda la aceptación (inmutable; reintenta una vez). Devuelve `true` si quedó registrada
 * (o si la 0053 no está aplicada). Si devuelve `false`, la solicitud ya existe pero queda MARCADA como pendiente: la residencia no puede
 * avanzarla y el estudiante ve el aviso con el botón «Leí y acepto» en su solicitud.
 */
export async function recordRegulationAcceptance(
  admin: SupabaseClient,
  params: {
    applicationRequestId: string;
    residenceId: string;
    regulation: RegulationToAccept;
    acceptedByUserId: string;
    acceptedByRole: "student" | "guardian";
  },
): Promise<boolean> {
  const ok = await insertAcceptance(admin, {
    applicationRequestId: params.applicationRequestId,
    residenceId: params.residenceId,
    regulation: params.regulation,
    actor: { userId: params.acceptedByUserId, role: params.acceptedByRole },
  });
  if (ok && params.regulation.versionId) await clearPending(admin, params.applicationRequestId);
  return ok;
}

export type AcceptForApplicationResult = { ok: true } | { ok: false; error: string };

/**
 * Aceptación posterior sobre una solicitud que nació sin ella. Quién acepta: el estudiante si es mayor; si es MENOR, solo su familiar con
 * vínculo activo (rol `guardian`). Mismas validaciones que al enviar (hash visto obligatorio y vigente). Idempotente.
 */
export async function acceptRegulationForApplication(
  admin: SupabaseClient,
  params: { applicationId: string; actorUserId: string; accepted: boolean; seenHash: string | null },
): Promise<AcceptForApplicationResult> {
  const { data: application, error } = await admin
    .from("application_requests")
    .select("id, residence_id, student_profile_id")
    .eq("id", params.applicationId)
    .maybeSingle();
  if (error || !application) return { ok: false, error: "No encontramos esa solicitud." };
  const { data: profileRow } = await admin
    .from("student_profiles")
    .select("user_id, is_minor")
    .eq("id", application.student_profile_id as string)
    .maybeSingle();
  const profile = profileRow as { user_id: string; is_minor: boolean } | null;
  if (!profile) return { ok: false, error: "No encontramos esa solicitud." };

  let role: "student" | "guardian";
  if (profile.user_id === params.actorUserId) {
    if (profile.is_minor) return { ok: false, error: "Sos menor de edad: el reglamento lo tiene que aceptar tu familiar vinculado desde su cuenta." };
    role = "student";
  } else {
    const link = await loadActiveFamilyLink(admin, params.actorUserId, application.student_profile_id as string);
    if (!link) return { ok: false, error: "No encontramos esa solicitud." };
    if (!profile.is_minor) return { ok: false, error: "Lo tiene que aceptar el estudiante desde su cuenta." };
    role = "guardian";
  }

  const { data: existing } = await admin
    .from("application_regulation_acceptances")
    .select("id")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (existing) return { ok: true };

  const resolved = await resolveRegulationToAccept(admin, {
    residenceId: application.residence_id as string,
    accepted: params.accepted,
    seenHash: params.seenHash,
  });
  if (!resolved.ok) return resolved;
  const saved = await insertAcceptance(admin, {
    applicationRequestId: params.applicationId,
    residenceId: application.residence_id as string,
    regulation: resolved.regulation,
    actor: { userId: params.actorUserId, role },
  });
  if (!saved) return { ok: false, error: "No pudimos registrar tu aceptación. Intentá de nuevo en unos minutos." };
  if (resolved.regulation.versionId) await clearPending(admin, params.applicationId);
  return { ok: true };
}
