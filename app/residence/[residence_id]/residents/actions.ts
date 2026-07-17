"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createResidentStay } from "@/lib/residents/createResidentStay";
import { endResidentStay } from "@/lib/residents/endResidentStay";
import { updateStayDetails } from "@/lib/residents/updateStayDetails";
import { assignStayToBed } from "@/lib/residences/roomManagement";
import { addResidentNote } from "@/lib/residents/addResidentNote";

export type ResidentsActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function createResidentStayAction(
  residenceId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const inviteEmail = String(formData.get("invite_email") ?? "").trim();
  const roomTypeId = String(formData.get("room_type_id") ?? "") || null;
  const startDate = String(formData.get("start_date") ?? "") || null;
  if (!inviteEmail) return { status: "error", message: "Ingresá el email del residente." };

  const result = await createResidentStay(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    inviteEmail,
    roomTypeId,
    reservationId: null,
    startDate,
    expectedEndDate: String(formData.get("expected_end_date") ?? "") || null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved" };
}

export async function updateStayDetailsAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const rateRaw = String(formData.get("monthly_rate_usd") ?? "").trim();
  const result = await updateStayDetails(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    expectedEndDate: String(formData.get("expected_end_date") ?? "") || null,
    monthlyRateUsd: rateRaw ? Number(rateRaw) : null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved" };
}

export async function assignBedToStayAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const bedId = String(formData.get("bed_id") ?? "");
  if (!bedId) return { status: "error", message: "Elegí una cama." };

  const result = await assignStayToBed(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    bedId,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved" };
}

export async function endResidentStayAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await endResidentStay(admin, { actorUserId: sessionUser.id, residentStayId, endDate: null });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  return { status: "saved" };
}

export async function addResidentNoteAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const category = String(formData.get("category") ?? "general");
  const result = await addResidentNote(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    category: category === "pagos" ? "pagos" : "general",
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  return { status: "saved" };
}
