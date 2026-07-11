"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createRenewalRequest } from "@/lib/renewals/createRenewalRequest";
import { respondRenewalOffer } from "@/lib/renewals/respondRenewalOffer";

export type RenewalFormState = { status: "idle" | "error" | "saved"; message?: string };

export async function requestRenewalAction(
  reservationId: string,
  _prev: RenewalFormState,
  formData: FormData,
): Promise<RenewalFormState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const message = String(formData.get("message") ?? "").trim() || null;
  const desiredDurationRaw = String(formData.get("desired_duration_months") ?? "").trim();

  const result = await createRenewalRequest(admin, {
    reservationId,
    actorUserId: sessionUser.id,
    message,
    desiredDurationMonths: desiredDurationRaw ? Number(desiredDurationRaw) : null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/renewals");
  return { status: "saved" };
}

export async function respondRenewalOfferAction(
  renewalOfferId: string,
  response: "accepted" | "rejected",
  _prev: RenewalFormState,
): Promise<RenewalFormState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await respondRenewalOffer(admin, { renewalOfferId, response, actorUserId: sessionUser.id });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/renewals/${renewalOfferId}`);
  revalidatePath("/students/renewals");
  return { status: "saved" };
}
