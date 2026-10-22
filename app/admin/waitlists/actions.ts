"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { removeFromWaitlistByAdmin } from "@/lib/waitlist-entries/removeFromWaitlistByAdmin";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type RemoveWaitlistActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function removeWaitlistEntryAction(
  waitlistEntryId: string,
  _prev: RemoveWaitlistActionState,
  formData: FormData,
): Promise<RemoveWaitlistActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await removeFromWaitlistByAdmin(admin, {
    waitlistEntryId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/waitlists");
  revalidatePath("/admin/activity");
  return { status: "saved", message: "Sacado de la lista. Se notificó al estudiante." };
}
