"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { joinWaitlist } from "@/lib/waitlist-entries/joinWaitlist";

export type JoinWaitlistState = { status: "idle" | "error" | "saved"; message?: string };

/** Docs/08 §5 ("CTA Sumarme a lista de espera si está completa o sin disponibilidad"). */
export async function joinWaitlistAction(
  residenceId: string,
  _prev: JoinWaitlistState,
  formData: FormData,
): Promise<JoinWaitlistState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Iniciá sesión para sumarte a la lista de espera." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const roomTypeId = String(formData.get("room_type_id") ?? "").trim() || null;
  const desiredStartDate = String(formData.get("desired_start_date") ?? "").trim() || null;
  const desiredDurationRaw = String(formData.get("desired_duration_months") ?? "").trim();

  const result = await joinWaitlist(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    roomTypeId,
    desiredStartDate,
    desiredDurationMonths: desiredDurationRaw ? Number(desiredDurationRaw) : null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  return { status: "saved" };
}
