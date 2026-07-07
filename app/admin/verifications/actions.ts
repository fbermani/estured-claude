"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";

export type ReviewState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Decisión de verificación de residencias (docs/06 §8.3, docs/12 §6.3).
 *
 * Simplificación deliberada respecto al modelo documental: el modelo
 * define scheduled_at/visited_at como pasos separados (agendar → marcar
 * visitada); acá se registran en el mismo formulario que la decisión
 * final, porque en esta etapa un solo admin hace ambas cosas. Los campos
 * existen igual en la tabla para cuando haga falta separar el flujo.
 */
export async function reviewResidence(
  residenceId: string,
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "No tenés permiso para esta acción." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const action = String(formData.get("action") ?? "");
  const responsibleChecked = formData.get("responsible_identity_checked") === "on";
  const coordinatorChecked = formData.get("coordinator_identity_checked") === "on";
  const addressChecked = formData.get("address_checked") === "on";
  const photosMatch = formData.get("photos_match_reality") === "on";
  const visitedAt = String(formData.get("visited_at") ?? "");
  const notesInternal = String(formData.get("notes_internal") ?? "").trim();

  if (!["approve", "needs_changes", "reject"].includes(action)) {
    return { status: "error", message: "Acción inválida." };
  }
  if (action === "approve" && !(responsibleChecked && addressChecked && photosMatch)) {
    return {
      status: "error",
      message:
        "Antes de aprobar, marcá al menos: identidad del responsable, dirección verificada y fotos coinciden con la realidad.",
    };
  }
  if ((action === "needs_changes" || action === "reject") && notesInternal.length < 5) {
    return { status: "error", message: "Escribí un motivo para que quede registrado." };
  }

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");
  const actorRole = sessionUser.roles.includes("superadmin") ? "superadmin" : "admin";

  const verificationUpdate: Record<string, unknown> = {
    responsible_identity_checked: responsibleChecked,
    coordinator_identity_checked: coordinatorChecked,
    address_checked: addressChecked,
    photos_match_reality: photosMatch,
    notes_internal: notesInternal || null,
    verified_by_user_id: sessionUser.id,
  };
  if (visitedAt) verificationUpdate.visited_at = new Date(visitedAt).toISOString();

  let residenceStatus: string;
  let verificationStatus: string;
  let auditAction: string;

  if (action === "approve") {
    residenceStatus = "verified_active";
    verificationStatus = "approved";
    auditAction = "residence_verification_approved";
    verificationUpdate.approved_at = new Date().toISOString();
    verificationUpdate.expires_at = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
  } else if (action === "needs_changes") {
    residenceStatus = "needs_changes";
    verificationStatus = "needs_changes";
    auditAction = "residence_verification_needs_changes";
  } else {
    residenceStatus = "suspended";
    verificationStatus = "rejected";
    auditAction = "residence_verification_rejected";
  }

  const { error: verificationError } = await admin
    .from("residence_verifications")
    .update({ ...verificationUpdate, status: verificationStatus })
    .eq("residence_id", residenceId);
  if (verificationError) {
    console.error("[admin-verify] update verification failed:", verificationError);
    return { status: "error", message: "No pudimos guardar la revisión. Intentá de nuevo." };
  }

  const { error: residenceError } = await admin
    .from("residences")
    .update({ status: residenceStatus })
    .eq("id", residenceId);
  if (residenceError) {
    console.error("[admin-verify] update residence failed:", residenceError);
    return { status: "error", message: "No pudimos guardar la revisión. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole,
    action: auditAction,
    entityType: "residences",
    entityId: residenceId,
    reasonText: notesInternal || undefined,
    newValue: { residence_status: residenceStatus, verification_status: verificationStatus },
    ipAddress: ip,
    userAgent,
    source: "admin",
  });

  revalidatePath("/admin/verifications");
  revalidatePath("/admin/dashboard");
  revalidatePath("/residence/dashboard");

  return {
    status: "saved",
    message:
      action === "approve"
        ? "Residencia aprobada y publicada."
        : action === "needs_changes"
          ? "Se pidieron cambios a la residencia."
          : "Residencia rechazada.",
  };
}
