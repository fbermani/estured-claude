"use server";

import { clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { addResidenceForOwner } from "@/lib/residences/addResidenceForOwner";

export type AddResidenceState = { status: "idle" | "error"; message?: string };

/**
 * Server action de "Sumar otra residencia" (H22). La identidad sale SIEMPRE
 * de la sesión (nunca de un campo del formulario) y exige el rol owner; el
 * staff no puede sumar residencias (docs/11 §7.3: solo owner). Valida y crea
 * dentro de `addResidenceForOwner`.
 */
export async function addResidence(_prev: AddResidenceState, formData: FormData): Promise<AddResidenceState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/residence/settings/new");
  if (!hasAnyRole(sessionUser, ["residence_owner"])) {
    return { status: "error", message: "Solo el responsable de la residencia puede sumar otra." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No está disponible en este momento. Probá más tarde." };

  const headerStore = await headers();
  const result = await addResidenceForOwner(admin, {
    ownerUserId: sessionUser.id,
    residenceName: String(formData.get("residence_name") ?? ""),
    propertyType: String(formData.get("property_type") ?? "").trim(),
    zone: String(formData.get("zone") ?? "").trim(),
    addressLine: String(formData.get("address_line") ?? ""),
    acceptResponsibility: formData.get("accept_responsibility") === "on",
    ipAddress: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  });
  if (!result.ok) return { status: "error", message: result.error };

  redirect(`/residence/${result.residenceId}/profile`);
}
