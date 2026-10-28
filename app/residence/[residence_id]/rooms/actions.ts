"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { renameRoom, setRoomGender, setBedStatus, assignStayToBed } from "@/lib/residences/roomManagement";

export type RoomsActionState = { status: "idle" | "error" | "saved"; message?: string };

async function requireContext() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { error: "Tu sesión expiró." as const };
  const admin = getSupabaseAdmin();
  if (!admin) return { error: "No disponible en este momento." as const };
  return { sessionUser, admin };
}

export async function renameRoomAction(
  residenceId: string,
  roomId: string,
  _prev: RoomsActionState,
  formData: FormData,
): Promise<RoomsActionState> {
  const ctx = await requireContext();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const result = await renameRoom(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    roomId,
    label: String(formData.get("label") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved" };
}

export async function setRoomGenderAction(
  residenceId: string,
  roomId: string,
  _prev: RoomsActionState,
  formData: FormData,
): Promise<RoomsActionState> {
  const ctx = await requireContext();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const result = await setRoomGender(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    roomId,
    gender: String(formData.get("gender") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/rooms`);
  revalidatePath("/residencias", "layout");
  return { status: "saved" };
}

export async function setBedStatusAction(
  residenceId: string,
  bedId: string,
  status: "active" | "out_of_service",
  _prev: RoomsActionState,
  formData: FormData,
): Promise<RoomsActionState> {
  const ctx = await requireContext();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const result = await setBedStatus(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    bedId,
    status,
    reason: String(formData.get("reason") ?? "") || null,
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved" };
}

export async function assignStayToBedAction(
  residenceId: string,
  bedId: string,
  _prev: RoomsActionState,
  formData: FormData,
): Promise<RoomsActionState> {
  const ctx = await requireContext();
  if ("error" in ctx) return { status: "error", message: ctx.error };

  const residentStayId = String(formData.get("resident_stay_id") ?? "");
  if (!residentStayId) return { status: "error", message: "Elegí un residente para asignar." };

  const result = await assignStayToBed(ctx.admin, {
    actorUserId: ctx.sessionUser.id,
    residenceId,
    residentStayId,
    bedId,
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/rooms`);
  revalidatePath(`/residence/${residenceId}/residents`);
  return { status: "saved" };
}
