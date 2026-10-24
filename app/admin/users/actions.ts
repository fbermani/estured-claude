"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { setUserBlockedStatus } from "@/lib/users/setUserBlockedStatus";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type UserBlockActionState = { status: "idle" | "error" | "saved"; message?: string };

async function runToggle(targetUserId: string, blocked: boolean, reason: string): Promise<UserBlockActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setUserBlockedStatus(admin, {
    actorUserId: sessionUser.id,
    actorRoles: sessionUser.roles,
    targetUserId,
    blocked,
    reason,
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/users");
  return { status: "saved", message: blocked ? "Usuario bloqueado." : "Usuario desbloqueado." };
}

export async function blockUser(
  targetUserId: string,
  _prev: UserBlockActionState,
  formData: FormData,
): Promise<UserBlockActionState> {
  return runToggle(targetUserId, true, String(formData.get("reason") ?? ""));
}

export async function unblockUser(targetUserId: string): Promise<UserBlockActionState> {
  return runToggle(targetUserId, false, "");
}
