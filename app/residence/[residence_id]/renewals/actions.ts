"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createRenewalOffer } from "@/lib/renewals/createRenewalOffer";
import { sendRenewalOffer } from "@/lib/renewals/sendRenewalOffer";
import { recordRenewalResidencePaymentReceived } from "@/lib/renewals/recordRenewalResidencePaymentReceived";

export type RenewalOfferFormState = { status: "idle" | "error"; message?: string };

export async function createRenewalOfferAction(
  reservationId: string,
  residenceId: string,
  renewalRequestId: string | null,
  _prev: RenewalOfferFormState,
  formData: FormData,
): Promise<RenewalOfferFormState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const periodStartDate = String(formData.get("period_start_date") ?? "").trim();
  const durationMonths = Number(formData.get("duration_months"));
  const monthlyPriceUsd = Number(formData.get("monthly_price_usd"));
  const enrollmentFeeRaw = String(formData.get("enrollment_or_renewal_fee_usd") ?? "").trim();
  const depositRaw = String(formData.get("deposit_usd") ?? "").trim();
  const adjustmentPolicy = String(formData.get("adjustment_policy") ?? "").trim();
  const deadlineDays = Number(formData.get("acceptance_deadline_days") ?? "7");
  const sendNow = formData.get("send_now") === "on";

  if (!periodStartDate) return { status: "error", message: "Elegí la fecha de inicio del nuevo período." };

  const acceptanceDeadlineAt = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await createRenewalOffer(admin, {
    reservationId,
    renewalRequestId,
    actorUserId: sessionUser.id,
    periodStartDate,
    durationMonths,
    monthlyPriceUsd,
    enrollmentOrRenewalFeeUsd: enrollmentFeeRaw ? Number(enrollmentFeeRaw) : null,
    depositUsd: depositRaw ? Number(depositRaw) : null,
    adjustmentPolicy,
    acceptanceDeadlineAt,
    sendNow,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/renewals/${reservationId}`);
  redirect(`/residence/${residenceId}/renewals/${reservationId}`);
}

export async function sendRenewalOfferAction(
  offerId: string,
  residenceId: string,
  reservationId: string,
  _prev: RenewalOfferFormState,
): Promise<RenewalOfferFormState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await sendRenewalOffer(admin, { renewalOfferId: offerId, actorUserId: sessionUser.id });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/renewals/${reservationId}`);
  redirect(`/residence/${residenceId}/renewals/${reservationId}`);
}

export async function markRenewalResidencePaymentReceivedAction(
  offerId: string,
  residenceId: string,
  reservationId: string,
  _prev: RenewalOfferFormState,
  formData: FormData,
): Promise<RenewalOfferFormState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const receiptFile = formData.get("receipt_file");

  const result = await recordRenewalResidencePaymentReceived(admin, {
    renewalOfferId: offerId,
    actorUserId: sessionUser.id,
    receivedAmountArs: Number(formData.get("received_amount_ars") ?? 0) || null,
    receivedAmountUsd: Number(formData.get("received_amount_usd") ?? 0) || null,
    paymentMethodLabel: String(formData.get("payment_method_label") ?? "").trim(),
    confirmationAccepted: formData.get("confirmation_checkbox_accepted") === "on",
    receiptFile: receiptFile instanceof File && receiptFile.size > 0 ? receiptFile : null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/renewals/${reservationId}`);
  return { status: "idle" };
}
