"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  setQualityVisibilityByAdmin,
  addResidenceInternalNote,
  type QualityVisibilityStatus,
} from "@/lib/residences/setQualityVisibilityByAdmin";

export type VisibilityActionState = { status: "idle" | "error" | "saved"; message?: string };

async function runStatusChange(
  residenceId: string,
  newStatus: QualityVisibilityStatus,
  reason: string,
): Promise<VisibilityActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setQualityVisibilityByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    newStatus,
    reason,
  });
  if (result.status === "error") return result;

  revalidatePath("/admin/visibility");
  return { status: "saved" };
}

export async function issueWarningAction(
  residenceId: string,
  _prev: VisibilityActionState,
  formData: FormData,
): Promise<VisibilityActionState> {
  return runStatusChange(residenceId, "warning", String(formData.get("reason") ?? ""));
}

export async function reduceVisibilityAction(
  residenceId: string,
  _prev: VisibilityActionState,
  formData: FormData,
): Promise<VisibilityActionState> {
  return runStatusChange(residenceId, "reduced_visibility", String(formData.get("reason") ?? ""));
}

export async function restoreVisibilityAction(
  residenceId: string,
  _prev: VisibilityActionState,
  formData: FormData,
): Promise<VisibilityActionState> {
  return runStatusChange(residenceId, "normal_visibility", String(formData.get("reason") ?? ""));
}

export async function addInternalNoteAction(
  residenceId: string,
  _prev: VisibilityActionState,
  formData: FormData,
): Promise<VisibilityActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await addResidenceInternalNote(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    note: String(formData.get("note") ?? ""),
  });
  if (result.status === "error") return result;

  revalidatePath("/admin/visibility");
  return { status: "saved" };
}
