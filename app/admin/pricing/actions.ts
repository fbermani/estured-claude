"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";

export type TariffReviewState = { status: "idle" | "error" | "saved"; message?: string };

/** Marca un cambio de tarifa como revisado (docs/09 §9.3) — solo auditoría, no revierte ni bloquea el cambio ya aplicado. */
export async function markTariffLogReviewed(
  logId: string,
  _prev: TariffReviewState,
  formData: FormData,
): Promise<TariffReviewState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "No tenés permiso para esta acción." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const reviewStatus = String(formData.get("review_status") ?? "reviewed");
  if (!["reviewed", "ignored", "flagged"].includes(reviewStatus)) {
    return { status: "error", message: "Estado inválido." };
  }

  const { data: log } = await admin.from("tariff_change_logs").select("residence_id").eq("id", logId).single();
  if (!log) return { status: "error", message: "Ese registro ya no existe." };

  const { error } = await admin
    .from("tariff_change_logs")
    .update({ admin_review_status: reviewStatus, reviewed_by: sessionUser.id, reviewed_at: new Date().toISOString() })
    .eq("id", logId);
  if (error) {
    console.error("[admin-pricing] review failed:", error);
    return { status: "error", message: "No pudimos guardar la revisión." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: sessionUser.roles.includes("superadmin") ? "superadmin" : "admin",
    action: "tariff_change_reviewed",
    entityType: "residences",
    entityId: log.residence_id,
    newValue: { tariff_log_id: logId, review_status: reviewStatus },
    source: "admin",
  });

  revalidatePath("/admin/pricing");
  revalidatePath("/admin/dashboard");
  return { status: "saved" };
}
