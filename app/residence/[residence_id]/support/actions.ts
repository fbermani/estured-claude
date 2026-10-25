"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { residenceActorRole } from "@/lib/residences/permissions";
import { openSupportCase, type OpenSupportCaseResult } from "@/lib/support/openSupportCase";

export type OpenCaseState = { status: "idle" | "error" | "saved"; message?: string };

export async function openResidenceSupportCase(
  residenceId: string,
  _prev: OpenCaseState,
  formData: FormData,
): Promise<OpenCaseState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) return { status: "error", message: "No tenés acceso a esta residencia." };

  const description = String(formData.get("description") ?? "");
  const termsAccepted = formData.get("terms_accepted") === "on";
  const evidenceFiles = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);

  let result: OpenSupportCaseResult;
  try {
    result = await openSupportCase(admin, {
      actorUserId: sessionUser.id,
      // Rol de la membresía de ESTA residencia, no el rol global de la cuenta.
      actorRole: residenceActorRole(membership),
      residenceId,
      description,
      termsReminderAccepted: termsAccepted,
      evidenceFiles,
    });
  } catch (error) {
    console.error("[support] openResidenceSupportCase failed:", error);
    return { status: "error", message: "No pudimos abrir el caso. Probá de nuevo." };
  }
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/support`);
  return { status: "saved", message: "Caso abierto. Nuestro equipo lo va a revisar." };
}
