"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { setFeePayer } from "@/lib/family/setFeePayer";

export type DesignatePayerState = { status: "idle" | "error" | "saved"; message?: string };

/** El estudiante designa quién paga el fee: él mismo o su familiar vinculado (DR4). Valida todo server-side en `setFeePayer`. */
export async function designateFeePayer(
  applicationId: string,
  payer: "self" | "family",
  _prev: DesignatePayerState,
): Promise<DesignatePayerState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setFeePayer(admin, { actorUserId: sessionUser.id, applicationId, payer });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/applications/${applicationId}/fee`);
  return { status: "saved" };
}
