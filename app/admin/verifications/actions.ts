"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/requireAdmin";
import { countResidencePhotos } from "@/lib/residences/countResidencePhotos";
import { publishPhotosError } from "@/lib/residences/photos";
import { isMissingColumnError } from "@/lib/residences/changesRequest";
import {
  AUDIT_ACTION,
  RESIDENCE_STATUS_AFTER,
  VERIFICATION_STATUS_AFTER,
  VERIFICATION_VALID_DAYS,
  argentinaToday,
  canReviewFrom,
  isReviewAction,
  validateReview,
} from "@/lib/residences/verificationReview";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";

export type ReviewState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Decisión de verificación de residencias (docs/06 §8.3, docs/12 §6.3; Ciclo 70, DR7).
 *
 * Acciones: programar visita (`verification_scheduled` + `scheduled_at`), aprobar (exige fecha de la visita realizada y
 * confirmación), pedir cambios (mensaje para la residencia; no guarda el checklist) y rechazar (motivo interno y
 * confirmación). Todas hacen un update condicional por el estado actual de la residencia (`canReviewFrom`) con chequeo
 * de filas afectadas: no pisan un estado que otro admin o el dueño ya movió.
 */
export async function reviewResidence(
  residenceId: string,
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "No tenés permiso para esta acción." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const rawAction = String(formData.get("action") ?? "");
  if (!isReviewAction(rawAction)) return { status: "error", message: "Acción inválida." };
  const action = rawAction;

  const responsibleChecked = formData.get("responsible_identity_checked") === "on";
  const coordinatorChecked = formData.get("coordinator_identity_checked") === "on";
  const addressChecked = formData.get("address_checked") === "on";
  const photosMatch = formData.get("photos_match_reality") === "on";

  const parsed = validateReview({
    action,
    confirmed: formData.get("confirmed") === "1",
    responsibleChecked,
    addressChecked,
    photosMatch,
    visitedAt: String(formData.get("visited_at") ?? ""),
    scheduledAt: String(formData.get("scheduled_at") ?? ""),
    notesInternal: String(formData.get("notes_internal") ?? ""),
    // Ciclo 66 (DR5): mensaje visible para la residencia, separado de las notas internas.
    changesMessage: String(formData.get("changes_message") ?? ""),
    today: argentinaToday(),
  });
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const { visitedAtIso, scheduledAtIso, notesInternal, changesMessage } = parsed.value;

  const { data: currentResidence } = await admin.from("residences").select("status").eq("id", residenceId).maybeSingle();
  const currentStatus = (currentResidence?.status as string | undefined) ?? null;
  if (!currentStatus) return { status: "error", message: "No encontramos la residencia." };
  if (!canReviewFrom(action, currentStatus)) {
    return {
      status: "error",
      message: "El estado de la residencia cambió mientras la revisabas. Recargá la página para ver cómo sigue.",
    };
  }

  if (action === "approve") {
    // Ciclo 54 (D12): no se publica sin al menos 3 fotos propias aprobadas.
    const photoCount = await countResidencePhotos(admin, residenceId);
    if (photoCount === null) {
      return { status: "error", message: "No pudimos comprobar las fotos de la residencia. Intentá de nuevo." };
    }
    const photosError = publishPhotosError(photoCount);
    if (photosError) return { status: "error", message: photosError };
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");
  const actorRole = sessionUser.roles.includes("superadmin") ? "superadmin" : "admin";

  const verificationUpdate: Record<string, unknown> = {};
  if (action === "schedule") {
    verificationUpdate.scheduled_at = scheduledAtIso;
  } else if (action === "needs_changes") {
    // No se guardan los tildes del checklist ni la fecha de visita: sin visita no hay checklist que registrar.
    if (notesInternal) verificationUpdate.notes_internal = notesInternal;
  } else {
    verificationUpdate.responsible_identity_checked = responsibleChecked;
    verificationUpdate.coordinator_identity_checked = coordinatorChecked;
    verificationUpdate.address_checked = addressChecked;
    verificationUpdate.photos_match_reality = photosMatch;
    verificationUpdate.notes_internal = notesInternal || null;
    verificationUpdate.verified_by_user_id = sessionUser.id;
    if (visitedAtIso) verificationUpdate.visited_at = visitedAtIso;
    if (action === "approve") {
      verificationUpdate.approved_at = new Date().toISOString();
      verificationUpdate.expires_at = new Date(Date.now() + VERIFICATION_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const residenceStatus = RESIDENCE_STATUS_AFTER[action];

  // Primero la residencia, con update condicional por el estado que se leyó: es la compuerta contra la carrera.
  const { data: moved, error: residenceError } = await admin
    .from("residences")
    .update({ status: residenceStatus })
    .eq("id", residenceId)
    .eq("status", currentStatus)
    .select("id");
  if (residenceError) {
    console.error("[admin-verify] update residence failed:", residenceError);
    return { status: "error", message: "No pudimos guardar la revisión. Intentá de nuevo." };
  }
  if ((moved ?? []).length === 0) {
    return {
      status: "error",
      message: "El estado de la residencia cambió mientras la revisabas. Recargá la página para ver cómo sigue.",
    };
  }

  // Pedir cambios guarda el mensaje para la residencia (migración 0048). Si la columna todavía no existe (0048 sin
  // aplicar), se pide igual los cambios pero el mensaje no se puede guardar: se le avisa al admin.
  let messageSaved = true;
  const verificationPayload = { ...verificationUpdate, status: VERIFICATION_STATUS_AFTER[action] };
  let { data: verificationRows, error: verificationError } = await admin
    .from("residence_verifications")
    .update({
      ...verificationPayload,
      ...(changesMessage ? { changes_requested_message: changesMessage, changes_requested_at: new Date().toISOString() } : {}),
    })
    .eq("residence_id", residenceId)
    .select("id");
  if (verificationError && changesMessage && isMissingColumnError(verificationError)) {
    messageSaved = false;
    ({ data: verificationRows, error: verificationError } = await admin
      .from("residence_verifications")
      .update(verificationPayload)
      .eq("residence_id", residenceId)
      .select("id"));
  }
  // 0 filas = la residencia no tiene fila de verificación: aprobarla la dejaría publicada sin `expires_at` ni `approved_at`.
  if (verificationError || (verificationRows ?? []).length === 0) {
    console.error("[admin-verify] update verification failed:", verificationError ?? "sin fila de verificación");
    // Sin esto la residencia queda en el estado nuevo con la verificación en otro: se deshace el cambio.
    const { error: rollbackError } = await admin
      .from("residences")
      .update({ status: currentStatus })
      .eq("id", residenceId)
      .eq("status", residenceStatus);
    if (rollbackError) console.error("[admin-verify] rollback of residence status failed:", rollbackError);
    return { status: "error", message: "No pudimos guardar la revisión. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole,
    action: AUDIT_ACTION[action],
    entityType: "residences",
    entityId: residenceId,
    oldValue: { residence_status: currentStatus },
    // Pedir cambios: queda el mensaje enviado a la residencia (historial; la fila se limpia al reenviar).
    reasonText: changesMessage ?? (notesInternal || undefined),
    newValue: {
      residence_status: residenceStatus,
      verification_status: VERIFICATION_STATUS_AFTER[action],
      ...(action === "schedule" ? { scheduled_at: scheduledAtIso } : {}),
      ...(action === "approve" ? { visited_at: visitedAtIso } : {}),
    },
    ipAddress: ip,
    userAgent,
    source: "admin",
  });

  // Aviso in-app + email al equipo de la residencia (best-effort: no rompe la acción si falla).
  if (action === "needs_changes") {
    await notifyResidenceTeam(admin, { residenceId, event: "changes_requested", entityId: residenceId });
  } else if (action === "approve") {
    await notifyResidenceTeam(admin, { residenceId, event: "verification_approved", entityId: residenceId });
  } else if (action === "reject") {
    await notifyResidenceTeam(admin, { residenceId, event: "verification_rejected", entityId: residenceId });
  }

  revalidatePath("/admin/verifications");
  revalidatePath("/admin/dashboard");
  revalidatePath("/residence/dashboard");
  revalidatePath(`/residence/${residenceId}`);
  revalidatePath(`/residence/${residenceId}/profile`);
  revalidatePath(`/admin/residences/${residenceId}`);

  if (action === "needs_changes" && !messageSaved) {
    return {
      status: "saved",
      message:
        "Se pidieron cambios y se avisó a la residencia, pero el mensaje no se pudo guardar: falta aplicar la migración 0048 en esta base. La residencia verá el aviso genérico.",
    };
  }

  const messages: Record<typeof action, string> = {
    schedule: "Visita programada. La residencia ve la fecha en su panel.",
    approve: "Residencia aprobada y publicada.",
    needs_changes: "Se pidieron cambios a la residencia.",
    reject: "Residencia rechazada.",
  };
  return { status: "saved", message: messages[action] };
}
