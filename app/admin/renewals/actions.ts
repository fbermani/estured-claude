"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { reopenRenewalRequest } from "@/lib/renewals/reopenRenewalRequest";
import { reopenRenewalOffer } from "@/lib/renewals/reopenRenewalOffer";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type RenewalReopenActionState = { status: "idle" | "error" | "saved"; message?: string };

export async function reopenRenewalRequestAction(
  renewalRequestId: string,
  _prev: RenewalReopenActionState,
  formData: FormData,
): Promise<RenewalReopenActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reopenRenewalRequest(admin, {
    renewalRequestId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/renewals");
  revalidatePath("/admin/activity");
  return { status: "saved", message: "Solicitud reabierta. Se notificó al estudiante." };
}

export async function reopenRenewalOfferAction(
  renewalOfferId: string,
  _prev: RenewalReopenActionState,
  formData: FormData,
): Promise<RenewalReopenActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await reopenRenewalOffer(admin, {
    renewalOfferId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/renewals");
  revalidatePath("/admin/activity");
  return { status: "saved", message: "Oferta reabierta (7 días más). Se notificó al estudiante." };
}
