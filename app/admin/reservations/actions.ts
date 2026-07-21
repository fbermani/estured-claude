"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { reopenEsturedFeeWindow } from "@/lib/reservations/reopenEsturedFeeWindow";

export type ReopenFeeWindowActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function reopenFeeWindowAction(
  feePaymentId: string,
  _prev: ReopenFeeWindowActionState,
  formData: FormData,
): Promise<ReopenFeeWindowActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reopenEsturedFeeWindow(admin, {
    feePaymentId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/reservations");
  revalidatePath("/admin/activity");
  return { status: "saved", message: "Pago del fee reabierto (48hs más). Se notificó al estudiante." };
}
