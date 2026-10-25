"use server";

import { revalidatePath } from "next/cache";
import { adminActorRole, getAdminSession } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { communicateFollowupToResidence, markFollowupReviewed } from "@/lib/followups/adminActions";

export type FollowupAdminState = { status: "idle" | "error" | "saved"; message?: string };

async function context() {
  const user = await getAdminSession();
  if (!user) return { error: "Tu sesión expiró." as const };
  const admin = getSupabaseAdmin();
  if (!admin) return { error: "No disponible en este momento." as const };
  return { user, admin };
}

export async function markReviewedAction(followupId: string, _prev: FollowupAdminState, formData: FormData): Promise<FollowupAdminState> {
  const ctx = await context();
  if ("error" in ctx) return { status: "error", message: ctx.error };
  const result = await markFollowupReviewed(ctx.admin, {
    actorUserId: ctx.user.id,
    actorRole: adminActorRole(ctx.user),
    followupId,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/admin/followups");
  return { status: "saved", message: "Seguimiento marcado como revisado." };
}

export async function communicateAction(followupId: string, _prev: FollowupAdminState, formData: FormData): Promise<FollowupAdminState> {
  const ctx = await context();
  if ("error" in ctx) return { status: "error", message: ctx.error };
  const result = await communicateFollowupToResidence(ctx.admin, {
    actorUserId: ctx.user.id,
    actorRole: adminActorRole(ctx.user),
    followupId,
    text: String(formData.get("text") ?? ""),
    resend: formData.get("resend") === "on",
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/admin/followups");
  return { status: "saved", message: "Mensaje enviado a la residencia." };
}
