"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { notifyWaitlistAvailability, notifyWaitlistBatch } from "@/lib/waitlist-entries/notifyWaitlistAvailability";
import { describeBatchResult } from "@/lib/waitlist-entries/board";
import { removeFromWaitlistByResidence } from "@/lib/waitlist-entries/removeFromWaitlistByResidence";

export type ResidenceWaitlistActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function notifyWaitlistAvailabilityAction(
  residenceId: string,
  waitlistEntryId: string,
  _prev: ResidenceWaitlistActionState,
): Promise<ResidenceWaitlistActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await notifyWaitlistAvailability(admin, { waitlistEntryId, actorUserId: sessionUser.id });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/waitlist`);
  return { status: "saved" };
}

export async function removeFromWaitlistAction(
  residenceId: string,
  waitlistEntryId: string,
  _prev: ResidenceWaitlistActionState,
  formData: FormData,
): Promise<ResidenceWaitlistActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const reason = String(formData.get("reason") ?? "").trim() || null;

  const result = await removeFromWaitlistByResidence(admin, { waitlistEntryId, actorUserId: sessionUser.id, reason });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/waitlist`);
  return { status: "saved" };
}

export type NotifyBatchActionState = { status: "idle" | "error" | "saved"; message?: string; notified?: number };

/** DR41: aviso «hay lugar» por lote (tope 50). El permiso `waitlist.manage` y cada entrada se validan en el servidor. */
export async function notifyWaitlistBatchAction(
  residenceId: string,
  waitlistEntryIds: string[],
): Promise<NotifyBatchActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await notifyWaitlistBatch(admin, { residenceId, waitlistEntryIds, actorUserId: sessionUser.id });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/waitlist`);
  const message = describeBatchResult(result);
  return { status: result.notified > 0 ? "saved" : "error", message, notified: result.notified };
}
