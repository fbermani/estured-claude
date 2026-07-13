"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { activateResidentStay } from "@/lib/residents/activateResidentStay";
import { setResidentVisibility } from "@/lib/residents/setResidentVisibility";

export type ResidencyActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function activateResidentStayAction(
  residentStayId: string,
  _prev: ResidencyActionState,
): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await activateResidentStay(admin, { actorUserId: sessionUser.id, residentStayId });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/residency");
  return { status: "saved" };
}

export async function setResidentVisibilityAction(
  residentStayId: string,
  hidden: boolean,
  _prev: ResidencyActionState,
): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setResidentVisibility(admin, { actorUserId: sessionUser.id, residentStayId, hidden });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/residency");
  return { status: "saved" };
}
