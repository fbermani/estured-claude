import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog, alertAdminsOfAuditFailure } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { REJECTION_REASON_MAX, REJECTION_REASON_MIN } from "@/lib/residences/reservationCollection";
import {
  isPaymentMethodKey,
  maskPaymentDetails,
  paymentMethodLabel,
  validatePaymentDetails,
  validatePaymentLabel,
} from "@/lib/payments/paymentMethods";

/**
 * Aprobación del admin de los datos de cobro de la reserva (DR63 (j) puntos 1 y 5, `docs/03` §7.3, `docs/07` §16.3). SOLO admin o
 * superadmin: el rol se lee de `user_roles` en el servidor, nunca del formulario ni de quien llama.
 *
 * Reglas:
 *  - Aprobar copia `pending_details` → `details` y `pending_method_label` → `method_label` (solo lo que está pendiente: un cambio de
 *    nombre no pisa los datos aprobados), limpia `pending_*` y marca `approved_at` / `approved_by_user_id`. Rige desde ahí.
 *  - Rechazar exige un motivo (10 a 300 caracteres), limpia `pending_*` y deja rigiendo lo aprobado antes. Si nunca hubo nada aprobado, la
 *    fila se borra (el medio queda «Sin datos»): la 0102 prohíbe una fila «Otro» sin nombre.
 *  - Ambas son condicionales por `pending_submitted_at`, el valor que el admin VIO al abrir la pantalla: si el dueño editó mientras
 *    tanto, no se aprueba ni se rechaza nada y se pide recargar. El valor viaja tal cual, sin pasar por `Date`.
 *  - Auditoría con los datos ENMASCARADOS (viejo y nuevo); el motivo del rechazo va en `reason_text`. Aviso in-app a los dueños, sin
 *    datos de cobro.
 * El dueño ve el motivo del rechazo en su pantalla, que lo lee del historial de auditoría (no hay columna propia).
 */

export type CollectionReviewResult = { ok: true; methodKey: string; method: string } | { ok: false; error: string };

const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);
const GENERIC_ERROR = "No pudimos completar la revisión. Intentá de nuevo.";
const NOT_READY_ERROR = "El cobro de la reserva todavía no está disponible en este entorno.";
export const STALE_ERROR = "El dueño cambió estos datos mientras los revisabas. Recargá la página para ver la versión actual.";
const NOTHING_PENDING_ERROR = "Este medio ya no tiene cambios pendientes. Recargá la página para ver cómo sigue.";
const NOT_ADMIN_ERROR = "No tenés permiso para esta acción.";

type AccountRow = {
  id: string;
  method_key: string;
  method_label: string | null;
  pending_method_label: string | null;
  details: string | null;
  pending_details: string | null;
  pending_submitted_at: string | null;
};
const ACCOUNT_COLUMNS = "id, method_key, method_label, pending_method_label, details, pending_details, pending_submitted_at";

const text = (s: string | null | undefined): string => (s ?? "").trim();
const errorMessage = (error: { code?: string } | null): string => (error?.code && SCHEMA_MISSING_CODES.has(error.code) ? NOT_READY_ERROR : GENERIC_ERROR);

/** Rol de admin del usuario, leído de `user_roles` (superadmin gana). `null` = no es admin ni superadmin. */
async function adminRoleOf(admin: SupabaseClient, userId: string): Promise<"admin" | "superadmin" | null> {
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("is_active", true).in("role", ["admin", "superadmin"]);
  if (error) {
    console.error("[collection-approval] role read failed:", error.code, error.message);
    return null;
  }
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  return roles.includes("superadmin") ? "superadmin" : roles.includes("admin") ? "admin" : null;
}

type Prepared = { role: "admin" | "superadmin"; row: AccountRow } | { error: string };

/** Pasos comunes: rol, clave del catálogo, lectura de la fila y chequeo de «lo que el admin vio sigue igual». */
async function prepare(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; methodKey: string; expectedSubmittedAt: string },
): Promise<Prepared> {
  const role = await adminRoleOf(admin, params.actorUserId);
  if (!role) return { error: NOT_ADMIN_ERROR };
  if (!params.residenceId || !isPaymentMethodKey(params.methodKey)) return { error: "No encontramos ese medio de cobro." };
  if (typeof params.expectedSubmittedAt !== "string" || params.expectedSubmittedAt === "") return { error: STALE_ERROR };

  const read = await admin
    .from("residence_collection_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("residence_id", params.residenceId)
    .eq("method_key", params.methodKey)
    .maybeSingle();
  if (read.error) {
    console.error("[collection-approval] account read failed:", read.error.code, read.error.message);
    return { error: errorMessage(read.error) };
  }
  const row = read.data as AccountRow | null;
  if (!row) return { error: "No encontramos ese medio de cobro." };
  if (text(row.pending_details) === "" && text(row.pending_method_label) === "") return { error: NOTHING_PENDING_ERROR };
  if (row.pending_submitted_at !== params.expectedSubmittedAt) return { error: STALE_ERROR };
  return { role, row };
}

/** Avisa a los dueños activos de la residencia. Sin datos de cobro. Nunca lanza. */
async function notifyOwners(admin: SupabaseClient, residenceId: string, title: string, body: string): Promise<void> {
  try {
    const { data } = await admin.from("residence_users").select("user_id").eq("residence_id", residenceId).eq("role", "owner").eq("is_active", true);
    const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
    await Promise.all(ids.map((userId) => createNotification(admin, { userId, title, body, relatedEntityType: "residence_collection_accounts", relatedEntityId: residenceId })));
  } catch (error) {
    console.error("[collection-approval] owner notify failed:", error);
  }
}

async function audit(admin: SupabaseClient, entry: Parameters<typeof createAuditLog>[1]): Promise<void> {
  const saved = await createAuditLog(admin, entry);
  // Es dinero de terceros: si el registro falla, la operación ya se hizo y se avisa a los admin para auditarla a mano.
  if (!saved && entry.entityId) await alertAdminsOfAuditFailure(admin, { action: entry.action, entityType: entry.entityType, entityId: entry.entityId });
}

export async function approveCollectionAccount(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; methodKey: string; expectedSubmittedAt: string },
): Promise<CollectionReviewResult> {
  const prepared = await prepare(admin, params);
  if ("error" in prepared) return { ok: false, error: prepared.error };
  const { role, row } = prepared;
  const key = row.method_key;
  const name = paymentMethodLabel(key, text(row.pending_method_label) || text(row.method_label));

  // Lo que queda vigente: lo pendiente si hay, si no lo que ya estaba. Se valida con las mismas reglas que el guardado del dueño.
  const nextDetails = validatePaymentDetails(text(row.pending_details) || text(row.details), name);
  if (!nextDetails.ok) return { ok: false, error: nextDetails.error };
  let nextLabel: string | null = null;
  if (key === "other") {
    const checked = validatePaymentLabel(text(row.pending_method_label) || text(row.method_label));
    if (!checked.ok) return { ok: false, error: checked.error };
    nextLabel = checked.value;
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("residence_collection_accounts")
    .update({
      details: nextDetails.value,
      ...(key === "other" ? { method_label: nextLabel } : {}),
      pending_details: null,
      pending_method_label: null,
      pending_submitted_at: null,
      approved_at: now,
      approved_by_user_id: params.actorUserId,
      updated_by_user_id: params.actorUserId,
    })
    .eq("id", row.id)
    .eq("pending_submitted_at", params.expectedSubmittedAt)
    .select("id");
  if (error) {
    console.error("[collection-approval] approve failed:", error.code, error.message);
    return { ok: false, error: errorMessage(error) };
  }
  if (!data || data.length === 0) return { ok: false, error: STALE_ERROR };

  await audit(admin, {
    actorUserId: params.actorUserId,
    actorRole: role,
    action: "residence_collection_account_approved",
    entityType: "residences",
    entityId: params.residenceId,
    oldValue: { method_key: key, details: row.details ? maskPaymentDetails(row.details) : null, method_label: text(row.method_label) || null },
    newValue: { method_key: key, details: maskPaymentDetails(nextDetails.value), method_label: nextLabel, approved_at: now },
    source: "admin",
  });
  await notifyOwners(admin, params.residenceId, "Datos de cobro aprobados", `EstuRed aprobó los datos de cobro de ${name}.`);
  return { ok: true, methodKey: key, method: name };
}

export async function rejectCollectionAccount(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; methodKey: string; expectedSubmittedAt: string; reason: unknown },
): Promise<CollectionReviewResult> {
  // El motivo se valida antes de leer nada: sin motivo no hay rechazo.
  const reason = typeof params.reason === "string" ? params.reason.trim() : "";
  if (reason.length < REJECTION_REASON_MIN) return { ok: false, error: `Escribí el motivo del rechazo (al menos ${REJECTION_REASON_MIN} caracteres). El dueño lo ve.` };
  if (reason.length > REJECTION_REASON_MAX) return { ok: false, error: `El motivo admite hasta ${REJECTION_REASON_MAX} caracteres.` };

  const prepared = await prepare(admin, params);
  if ("error" in prepared) return { ok: false, error: prepared.error };
  const { role, row } = prepared;
  const key = row.method_key;
  const name = paymentMethodLabel(key, text(row.pending_method_label) || text(row.method_label));
  const hasApproved = text(row.details) !== "" || text(row.method_label) !== "";

  const base = admin.from("residence_collection_accounts");
  const { data, error } = hasApproved
    ? await base
        .update({ pending_details: null, pending_method_label: null, pending_submitted_at: null, updated_by_user_id: params.actorUserId })
        .eq("id", row.id)
        .eq("pending_submitted_at", params.expectedSubmittedAt)
        .select("id")
    : await base.delete().eq("id", row.id).eq("pending_submitted_at", params.expectedSubmittedAt).select("id");
  if (error) {
    console.error("[collection-approval] reject failed:", error.code, error.message);
    return { ok: false, error: errorMessage(error) };
  }
  if (!data || data.length === 0) return { ok: false, error: STALE_ERROR };

  await audit(admin, {
    actorUserId: params.actorUserId,
    actorRole: role,
    action: "residence_collection_account_rejected",
    entityType: "residences",
    entityId: params.residenceId,
    oldValue: {
      method_key: key,
      pending_details: row.pending_details ? maskPaymentDetails(row.pending_details) : null,
      details: row.details ? maskPaymentDetails(row.details) : null,
    },
    newValue: { method_key: key, method_label: text(row.pending_method_label) || text(row.method_label) || null, kept_approved: hasApproved },
    reasonText: reason,
    source: "admin",
  });
  await notifyOwners(
    admin,
    params.residenceId,
    "Datos de cobro rechazados",
    hasApproved
      ? `EstuRed rechazó el cambio de los datos de cobro de ${name}. Siguen rigiendo los datos anteriores. Entrá a «Cobro de la reserva» para ver el motivo.`
      : `EstuRed rechazó los datos de cobro de ${name}. Entrá a «Cobro de la reserva» para ver el motivo y cargarlos de nuevo.`,
  );
  return { ok: true, methodKey: key, method: name };
}
