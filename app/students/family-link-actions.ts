"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";

export type FamilyLinkDecisionState = { status: "idle" | "error"; message?: string };

/**
 * El estudiante aprueba o rechaza una solicitud de vinculación
 * (docs/00 §17.1: "mientras el vínculo no está aprobado, el familiar
 * no puede operar"). Solo el propio estudiante puede decidir — nunca
 * el familiar, ni siquiera sobre su propia solicitud.
 */
export async function respondFamilyLink(
  linkId: string,
  decision: "approve" | "reject",
): Promise<FamilyLinkDecisionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { data: link } = await admin
    .from("family_links")
    .select("id, status, student_profile_id")
    .eq("id", linkId)
    .maybeSingle();
  if (!link || link.student_profile_id !== studentProfile.id) {
    return { status: "error", message: "No encontramos esa solicitud." };
  }
  if (link.status !== "pending_student_approval") {
    return { status: "error", message: "Esa solicitud ya fue resuelta." };
  }

  const newStatus = decision === "approve" ? "active" : "rejected_by_student";
  const { error } = await admin
    .from("family_links")
    .update({
      status: newStatus,
      approved_at: decision === "approve" ? new Date().toISOString() : null,
    })
    .eq("id", linkId);
  if (error) {
    console.error("[family-link] update failed:", error);
    return { status: "error", message: "No pudimos guardar tu respuesta. Intentá de nuevo." };
  }

  const headerStore = await headers();
  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: decision === "approve" ? "family_link_approved" : "family_link_rejected",
    entityType: "family_links",
    entityId: linkId,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerStore.get("user-agent"),
  });

  revalidatePath("/students/dashboard");
  return { status: "idle" };
}
