"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { updateSupportCaseStatus } from "@/lib/support/updateSupportCaseStatus";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type UpdateCaseActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function updateSupportCaseStatusAction(
  supportCaseId: string,
  _prev: UpdateCaseActionState,
  formData: FormData,
): Promise<UpdateCaseActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await updateSupportCaseStatus(admin, {
    supportCaseId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    newStatus: String(formData.get("status") ?? ""),
    outcome: String(formData.get("outcome") ?? "") || null,
    notes: String(formData.get("notes") ?? ""),
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/support-cases");
  return { status: "saved", message: "Caso actualizado." };
}
