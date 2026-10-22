"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { setResidencePausedByAdmin } from "@/lib/residences/setResidencePausedByAdmin";
import { setOperationalAccessByAdmin } from "@/lib/residences/setOperationalAccessByAdmin";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type PauseResidenceActionState = { status: "idle" | "error" | "saved"; message?: string };

async function runToggle(residenceId: string, paused: boolean, reason: string): Promise<PauseResidenceActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setResidencePausedByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    paused,
    reason,
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/residences");
  return { status: "saved", message: paused ? "Residencia pausada." : "Residencia reactivada." };
}

export async function pauseResidenceAction(
  residenceId: string,
  _prev: PauseResidenceActionState,
  formData: FormData,
): Promise<PauseResidenceActionState> {
  return runToggle(residenceId, true, String(formData.get("reason") ?? ""));
}

export async function reactivateResidenceAction(residenceId: string): Promise<PauseResidenceActionState> {
  return runToggle(residenceId, false, "");
}

export type OperationalAccessActionState = { status: "idle" | "error" | "saved"; message?: string };

async function runOperationalAccessToggle(
  residenceId: string,
  granted: boolean,
  reason: string,
  expiresAt: string | null,
): Promise<OperationalAccessActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setOperationalAccessByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    granted,
    reason,
    expiresAt,
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/residences");
  return { status: "saved", message: granted ? "Acceso a Gestión Operativa otorgado." : "Acceso a Gestión Operativa revocado." };
}

export async function grantOperationalAccessAction(
  residenceId: string,
  _prev: OperationalAccessActionState,
  formData: FormData,
): Promise<OperationalAccessActionState> {
  const expiresAt = String(formData.get("expires_at") ?? "").trim();
  return runOperationalAccessToggle(residenceId, true, String(formData.get("reason") ?? ""), expiresAt || null);
}

export async function revokeOperationalAccessAction(
  residenceId: string,
  _prev: OperationalAccessActionState,
  formData: FormData,
): Promise<OperationalAccessActionState> {
  return runOperationalAccessToggle(residenceId, false, String(formData.get("reason") ?? ""), null);
}
