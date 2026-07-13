"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createResidentStay } from "@/lib/residents/createResidentStay";
import { endResidentStay } from "@/lib/residents/endResidentStay";

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
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
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
