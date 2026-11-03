"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { decideFreedPlaceByResidence, saveRoomChangeRequestByResidence, updateRoomChangeStatusByResidence } from "@/lib/roomChange/manage";
import { parsePlaceAlertDecision } from "@/lib/roomChange/rules";

export type RoomChangeActionState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Cambio de habitación (DR34), lado residencia. Solo sesión, FormData y revalidación: el permiso (`residents.manage`; publicar exige además
 * `operations.rooms_availability`) y la validación viven en `lib/roomChange/manage.ts`.
 */
const SESSION_EXPIRED: RoomChangeActionState = { status: "error", message: "Tu sesión expiró." };
const UNAVAILABLE: RoomChangeActionState = { status: "error", message: "No disponible en este momento." };

function refresh(residenceId: string) {
  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/availability`);
  revalidatePath(`/residence/${residenceId}/rooms`);
}

/** «Solicita cambio de habitación» desde la ficha del residente. Campos: `room_type_id`, `gender`, `note`, `reason`. */
export async function saveRoomChangeRequestAction(
  residenceId: string,
  residentStayId: string,
  _prev: RoomChangeActionState,
  formData: FormData,
): Promise<RoomChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;
  const result = await saveRoomChangeRequestByResidence(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    roomTypeId: formData.get("room_type_id"),
    gender: formData.get("gender"),
    note: formData.get("note"),
    reason: formData.get("reason"),
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  return { status: "saved", message: result.message };
}

/** Cambia el estado de un pedido. Los botones llevan `name="to"` con el estado destino (pending / offered / resolved / cancelled). */
export async function updateRoomChangeStatusAction(
  residenceId: string,
  requestId: string,
  _prev: RoomChangeActionState,
  formData: FormData,
): Promise<RoomChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;
  const result = await updateRoomChangeStatusByResidence(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    requestId,
    to: String(formData.get("to") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  return { status: "saved", message: result.message };
}

/** Decide qué hacer con una plaza liberada. Los botones llevan `name="decision"` (offer / ignore / publish) y, para ofrecer, `request_id`. */
export async function decideFreedPlaceAction(
  residenceId: string,
  alertId: string,
  _prev: RoomChangeActionState,
  formData: FormData,
): Promise<RoomChangeActionState> {
  const decision = parsePlaceAlertDecision(formData.get("decision"));
  if (!decision) return { status: "error", message: "Elegí qué hacer con la plaza." };
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;
  const result = await decideFreedPlaceByResidence(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    alertId,
    decision,
    requestId: String(formData.get("request_id") ?? "") || null,
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh(residenceId);
  return { status: "saved", message: result.message };
}
