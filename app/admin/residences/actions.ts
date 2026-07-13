"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { setResidencePausedByAdmin } from "@/lib/residences/setResidencePausedByAdmin";

export type PauseResidenceActionState = { status: "idle" | "error" | "saved"; message?: string };

async function runToggle(residenceId: string, paused: boolean, reason: string): Promise<PauseResidenceActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setResidencePausedByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    paused,
    reason,
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/residences");
  return { status: "saved", message: paused ? "Residencia pausada." : "Residencia reactivada." };
}

export async function pauseResidenceAction(
  residenceId: string,
  _prev: PauseResidenceActionState,
  formData: FormData,
): Promise<PauseResidenceActionState> {
  return runToggle(residenceId, true, String(formData.get("reason") ?? ""));
}

export async function reactivateResidenceAction(residenceId: string): Promise<PauseResidenceActionState> {
  return runToggle(residenceId, false, "");
}
