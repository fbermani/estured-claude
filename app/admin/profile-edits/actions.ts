"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { applyApprovedEdit, discardRejectedFiles } from "@/lib/residences/profileEdits";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type ProfileEditReviewState = { status: "idle" | "error" | "saved"; message?: string };

const FIELD_GROUP_LABELS: Record<string, string> = {
  photos: "fotos",
  services: "servicios",
  rules: "reglas y reglamento",
  minimum_stay_months: "mínimo de estadía",
  room_types: "tipos de habitación",
};

/**
 * Decisión sobre una edición de perfil pendiente (docs/09 §8.4, migración
 * 0027). El enum de `residence_profile_edits.status` no distingue
 * "rechazar" de "pedir corrección" — ambas cierran la fila en `rejected`
 * (la residencia puede volver a enviar el mismo campo cuando corrija);
 * lo que cambia es el motivo auditado y el copy de la notificación.
 */
export async function reviewProfileEdit(
  editId: string,
  _prev: ProfileEditReviewState,
  formData: FormData,
): Promise<ProfileEditReviewState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "No tenés permiso para esta acción." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const action = String(formData.get("action") ?? "");
  const reviewNotes = String(formData.get("review_notes") ?? "").trim();

  if (!["approve", "reject", "needs_changes"].includes(action)) {
    return { status: "error", message: "Acción inválida." };
  }
  if ((action === "reject" || action === "needs_changes") && reviewNotes.length < 5) {
    return { status: "error", message: "Escribí un motivo para que quede registrado y la residencia lo vea." };
  }

  const { data: edit } = await admin
    .from("residence_profile_edits")
    .select("id, residence_id, field_group, new_value, submitted_by, status")
    .eq("id", editId)
    .single();
  if (!edit) return { status: "error", message: "Esa edición ya no existe." };
  if (edit.status !== "pending_admin_review") {
    return { status: "error", message: "Esta edición ya fue revisada por otro admin." };
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");
  const actorRole = sessionUser.roles.includes("superadmin") ? "superadmin" : "admin";
  const fieldLabel = FIELD_GROUP_LABELS[edit.field_group] ?? edit.field_group;

  let newStatus: string;
  let auditAction: string;
  let notificationTitle: string;
  let notificationBody: string;

  if (action === "approve") {
    const applied = await applyApprovedEdit(admin, edit, sessionUser.id);
    if (!applied.ok) return { status: "error", message: applied.error };
    newStatus = "approved";
    auditAction = "residence_profile_edit_approved";
    notificationTitle = "Cambio aprobado";
    notificationBody = `Tu cambio de ${fieldLabel} ya está publicado.`;
  } else {
    await discardRejectedFiles(admin, edit);
    newStatus = "rejected";
    auditAction = action === "reject" ? "residence_profile_edit_rejected" : "residence_profile_edit_correction_requested";
    notificationTitle = action === "reject" ? "Cambio rechazado" : "Te pedimos una corrección";
    notificationBody = `Tu cambio de ${fieldLabel} no se publicó. Motivo: ${reviewNotes}`;
  }

  const { error: updateError } = await admin
    .from("residence_profile_edits")
    .update({
      status: newStatus,
      reviewed_by: sessionUser.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
    })
    .eq("id", editId);
  if (updateError) {
    console.error("[admin-profile-edits] update failed:", updateError);
    return { status: "error", message: "No pudimos guardar la revisión. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole,
    action: auditAction,
    entityType: "residences",
    entityId: edit.residence_id,
    reasonText: reviewNotes || undefined,
    newValue: { field_group: edit.field_group, edit_id: edit.id },
    ipAddress: ip,
    userAgent,
    source: "admin",
  });

  await createNotification(admin, {
    userId: edit.submitted_by,
    title: notificationTitle,
    body: notificationBody,
    relatedEntityType: "residences",
    relatedEntityId: edit.residence_id,
  });

  revalidatePath("/admin/profile-edits");
  revalidatePath("/admin/dashboard");
  revalidatePath(`/residence/${edit.residence_id}/profile`);
  revalidatePath(`/residence/${edit.residence_id}`);
  revalidatePath("/residence/dashboard");
  revalidatePath("/search");

  return {
    status: "saved",
    message:
      action === "approve"
        ? "Cambio aprobado y publicado."
        : action === "needs_changes"
          ? "Se pidió corrección a la residencia."
          : "Cambio rechazado.",
  };
}
