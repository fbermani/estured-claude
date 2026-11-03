"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { cancelRoomChangeRequestByStudent, createRoomChangeRequestByStudent } from "@/lib/roomChange/student";

export type StudentRoomChangeState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Cambio de habitación (DR34), lado estudiante. Solo sesión, FormData y revalidación; la validación, la estadía propia y la regla de menores
 * viven en `lib/roomChange/student.ts`. Campos: `room_type_id`, `gender`, `note`, `reason`, `confirm_costs`.
 */
const SESSION_EXPIRED: StudentRoomChangeState = { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
const UNAVAILABLE: StudentRoomChangeState = { status: "error", message: "No disponible en este momento. Probá más tarde." };

function refresh() {
  revalidatePath("/students/residency");
  revalidatePath("/students/dashboard");
}

export async function createRoomChangeRequestAction(_prev: StudentRoomChangeState, formData: FormData): Promise<StudentRoomChangeState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;
  const confirm = formData.get("confirm_costs");
  const result = await createRoomChangeRequestByStudent(admin, {
    actorUserId: sessionUser.id,
    confirmed: confirm === "on" || confirm === "true" || confirm === "1",
    roomTypeId: formData.get("room_type_id"),
    gender: formData.get("gender"),
    note: formData.get("note"),
    reason: formData.get("reason"),
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: result.message };
}

export async function cancelRoomChangeRequestAction(requestId: string, _prev: StudentRoomChangeState): Promise<StudentRoomChangeState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;
  const result = await cancelRoomChangeRequestByStudent(admin, { actorUserId: sessionUser.id, requestId });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: result.message };
}
