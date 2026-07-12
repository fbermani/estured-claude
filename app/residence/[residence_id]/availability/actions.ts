"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { updateAvailability } from "@/lib/availability/updateAvailability";

export type AvailabilityActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function updateAvailabilityAction(
  residenceId: string,
  roomTypeId: string,
  _prev: AvailabilityActionState,
  formData: FormData,
): Promise<AvailabilityActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const status = String(formData.get("status") ?? "");
  const availableCountRaw = String(formData.get("available_count") ?? "").trim();
  const availableFrom = String(formData.get("available_from") ?? "").trim() || null;
  const notesPublic = String(formData.get("notes_public") ?? "").trim() || null;

  const result = await updateAvailability(admin, {
    roomTypeId,
    actorUserId: sessionUser.id,
    status,
    availableCount: availableCountRaw ? Number(availableCountRaw) : null,
    availableFrom,
    notesPublic,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/availability`);
  return { status: "saved" };
}
