"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { submitFollowupResponse } from "@/lib/followups/respond";

export type FollowupFormState = { status: "idle" | "error" | "done"; message?: string };

export async function submitFollowupAction(
  followupId: string,
  _prev: FollowupFormState,
  formData: FormData,
): Promise<FollowupFormState> {
  const user = await getSessionUser();
  if (!user || !hasAnyRole(user, ["student", "family_member"])) {
    return { status: "error", message: "Tu sesión expiró. Volvé a ingresar." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await submitFollowupResponse(admin, {
    userId: user.id,
    followupId,
    howIsItGoing: String(formData.get("howIsItGoing") ?? ""),
    wasAsExpected: String(formData.get("wasAsExpected") ?? ""),
    comment: String(formData.get("comment") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/students/followup/${followupId}`);
  return { status: "done" };
}
