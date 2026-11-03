"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { updateAvailability } from "@/lib/availability/updateAvailability";
import { updateTypeAvailabilityByGender } from "@/lib/availability/updateGenderAvailability";
import { parseGenderRow, type GenderRowRaw } from "@/lib/availability/genderAvailability";
import { ROOM_GENDERS } from "@/lib/residences/roomGender";

export type AvailabilityActionState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Guarda la disponibilidad de UN tipo de habitación desde la pantalla Disponibilidad (única puerta de entrada).
 * `mode = "genders"`: una fila por género (migración 0075). `mode = "legacy"`: la migración no está aplicada; se guarda el tipo entero
 * como antes (una sola fila, campos `*__mixto`). La validación y el permiso (`operations.rooms_availability`) están en las funciones de lib.
 */
export async function saveTypeAvailabilityAction(
  residenceId: string,
  roomTypeId: string,
  mode: "genders" | "legacy",
  _prev: AvailabilityActionState,
  formData: FormData,
): Promise<AvailabilityActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const rows: Partial<Record<string, GenderRowRaw>> = {};
  for (const gender of ROOM_GENDERS) {
    if (!formData.has(`status__${gender}`)) continue;
    rows[gender] = {
      status: formData.get(`status__${gender}`),
      count: formData.get(`count__${gender}`),
      from: formData.get(`from__${gender}`),
      note: formData.get(`note__${gender}`),
    };
  }

  if (mode === "legacy") {
    const raw = rows.mixto;
    if (!raw) return { status: "error", message: "Recargá la página e intentá de nuevo." };
    const parsed = parseGenderRow("mixto", raw, "Este tipo de habitación");
    if (!parsed.ok) return { status: "error", message: parsed.error };
    const result = await updateAvailability(admin, {
      roomTypeId,
      actorUserId: sessionUser.id,
      status: parsed.row.status,
      availableCount: parsed.row.availableCount,
      availableFrom: parsed.row.availableFrom,
      notesPublic: parsed.row.notesPublic,
    });
    if (!result.ok) return { status: "error", message: result.error };
  } else {
    const result = await updateTypeAvailabilityByGender(admin, { residenceId, roomTypeId, actorUserId: sessionUser.id, rows });
    if (!result.ok) return { status: "error", message: result.error };
  }

  revalidatePath(`/residence/${residenceId}/availability`);
  revalidatePath("/residencias", "layout");
  return { status: "saved", message: "Disponibilidad actualizada." };
}
