"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { reopenApplication } from "@/lib/applications/reopenApplication";

export type ReopenApplicationActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function reopenApplicationAction(
  applicationId: string,
  _prev: ReopenApplicationActionState,
  formData: FormData,
): Promise<ReopenApplicationActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reopenApplication(admin, {
    applicationId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/applications");
  return { status: "saved", message: "Solicitud reabierta. Se notificó al estudiante." };
}
