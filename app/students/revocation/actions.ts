"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { revokeEsturedFee } from "@/lib/reservations/revokeEsturedFee";

export type RevokeFeeState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Capa fina (docs/07 §18.6) — resuelve sesión, parsea `FormData` y
 * delega toda la lógica de negocio a `revokeEsturedFee`, mismo patrón
 * ya usado en el resto de acciones de dinero del proyecto.
 */
export async function revokeEsturedFeeAction(
  reservationId: string,
  _prev: RevokeFeeState,
  formData: FormData,
): Promise<RevokeFeeState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await revokeEsturedFee(admin, {
    reservationId,
    actorUserId: sessionUser.id,
    reason: String(formData.get("reason") ?? "").trim() || null,
    acknowledgeNoAutomaticRefund: formData.get("acknowledge_no_automatic_refund") === "on",
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/revocation");
  revalidatePath("/students/dashboard");
  return { status: "saved" };
}
