"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { setResidentVisibilityByAdmin } from "@/lib/residents/setResidentVisibilityByAdmin";
import { markResidentInactiveByAdmin } from "@/lib/residents/markResidentInactiveByAdmin";

export type ModerationResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !hasAnyRole(sessionUser, ["admin", "superadmin"])) {
    return { sessionUser: null, error: "No tenés permiso para esta acción." };
  }
  return { sessionUser, error: null };
}

export async function limitResidentVisibility(residentStayId: string, reason: string): Promise<ModerationResult> {
  const { sessionUser, error } = await requireAdmin();
  if (!sessionUser) return { ok: false, error: error! };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "No disponible en este momento." };

  const result = await setResidentVisibilityByAdmin(admin, {
    adminUserId: sessionUser.id,
    adminRole: sessionUser.roles.includes("superadmin") ? "superadmin" : "admin",
    residentStayId,
    hidden: true,
    reason,
  });
  if (result.ok) revalidatePath("/admin/community");
  return result;
}

export async function restoreResidentVisibility(residentStayId: string): Promise<ModerationResult> {
  const { sessionUser, error } = await requireAdmin();
  if (!sessionUser) return { ok: false, error: error! };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "No disponible en este momento." };

  const result = await setResidentVisibilityByAdmin(admin, {
    adminUserId: sessionUser.id,
    adminRole: sessionUser.roles.includes("superadmin") ? "superadmin" : "admin",
    residentStayId,
    hidden: false,
    reason: "",
  });
  if (result.ok) revalidatePath("/admin/community");
  return result;
}

export async function markResidentInactive(residentStayId: string, reason: string): Promise<ModerationResult> {
  const { sessionUser, error } = await requireAdmin();
  if (!sessionUser) return { ok: false, error: error! };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "No disponible en este momento." };

  const result = await markResidentInactiveByAdmin(admin, {
    adminUserId: sessionUser.id,
    adminRole: sessionUser.roles.includes("superadmin") ? "superadmin" : "admin",
    residentStayId,
    reason,
  });
  if (result.ok) revalidatePath("/admin/community");
  return result;
}
