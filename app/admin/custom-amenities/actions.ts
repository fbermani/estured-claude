"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adminActorRole, getAdminSession } from "@/lib/auth/requireAdmin";
import { reviewCustomAmenity } from "@/lib/residences/customAmenitiesDb";

export type CustomAmenityReviewState = { status: "idle" | "error" | "saved"; message?: string };

/** Aprobar o rechazar un ítem «Otro» (DR18). Solo admin/superadmin; la decisión sale del botón (`name="decision"`), nunca del cliente como estado. */
export async function reviewCustomAmenityAction(
  id: string,
  _prev: CustomAmenityReviewState,
  formData: FormData,
): Promise<CustomAmenityReviewState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") return { status: "error", message: "Elegí aprobar o rechazar." };

  const result = await reviewCustomAmenity(admin, {
    id,
    decision,
    reason: String(formData.get("reason") ?? ""),
    actorUserId: sessionUser.id,
    actorRole: adminActorRole(sessionUser),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/admin/custom-amenities");
  revalidatePath("/residencias/[slug]", "page");
  return { status: "saved" };
}
