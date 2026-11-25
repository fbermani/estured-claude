"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { leaveWaitlist } from "@/lib/waitlist-entries/leaveWaitlist";
import { stayInWaitlist } from "@/lib/waitlist-entries/stayInWaitlist";
import { activateFromWaitlist } from "@/lib/waitlist-entries/activateFromWaitlist";
import { minorHoldError } from "@/lib/students/minorHold";

export type WaitlistActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function leaveWaitlistAction(
  waitlistEntryId: string,
  _prev: WaitlistActionState,
): Promise<WaitlistActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await leaveWaitlist(admin, { waitlistEntryId, actorUserId: sessionUser.id });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/waitlist");
  return { status: "saved" };
}

export async function stayInWaitlistAction(
  waitlistEntryId: string,
  _prev: WaitlistActionState,
): Promise<WaitlistActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await stayInWaitlist(admin, { waitlistEntryId, actorUserId: sessionUser.id });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/waitlist");
  return { status: "saved" };
}

export async function activateFromWaitlistAction(
  waitlistEntryId: string,
  _prev: WaitlistActionState,
  formData: FormData,
): Promise<WaitlistActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  // DR65 (e): la cuenta de un menor sin consentimiento del familiar está en espera.
  const onHold = await minorHoldError(admin, sessionUser.id);
  if (onHold) return { status: "error", message: onHold };

  const desiredStartDate = String(formData.get("desired_start_date") ?? "").trim();
  const durationRaw = String(formData.get("initial_duration_months") ?? "").trim();
  if (!desiredStartDate || !durationRaw) {
    return { status: "error", message: "Completá la fecha de ingreso y la duración." };
  }

  const result = await activateFromWaitlist(admin, {
    waitlistEntryId,
    actorUserId: sessionUser.id,
    desiredStartDate,
    durationMonths: Number(durationRaw),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/waitlist");
  return { status: "saved" };
}
