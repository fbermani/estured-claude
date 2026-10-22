"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hideResidenceQuestionByAdmin } from "@/lib/faq/moderateResidenceQuestion";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type AdminFaqActionState = { status: "idle" | "error" | "saved"; message?: string };

/** Ocultar una pregunta libre de una ficha (moderación de EstuRed, D9). Solo admin/superadmin. */
export async function hideFaqQuestionAsAdminAction(
  questionId: string,
  _prev: AdminFaqActionState,
  formData: FormData,
): Promise<AdminFaqActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await hideResidenceQuestionByAdmin(admin, {
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    questionId,
    reason: String(formData.get("reason") ?? "").slice(0, 300),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/admin/faq");
  revalidatePath("/residencias/[slug]", "page");
  return { status: "saved" };
}
