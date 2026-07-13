"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { openSupportCase, type OpenSupportCaseResult } from "@/lib/support/openSupportCase";

export type OpenCaseState = { status: "idle" | "error" | "saved"; message?: string };

export async function openStudentSupportCase(_prev: OpenCaseState, formData: FormData): Promise<OpenCaseState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const residenceId = String(formData.get("residence_id") ?? "");
  const description = String(formData.get("description") ?? "");
  const termsAccepted = formData.get("terms_accepted") === "on";
  const evidenceFiles = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);

  if (!residenceId) return { status: "error", message: "Elegí a qué residencia corresponde el reclamo." };

  let result: OpenSupportCaseResult;
  try {
    result = await openSupportCase(admin, {
      actorUserId: sessionUser.id,
      actorRole: sessionUser.primaryRole,
      residenceId,
      description,
      termsReminderAccepted: termsAccepted,
      evidenceFiles,
    });
  } catch (error) {
    console.error("[support] openStudentSupportCase failed:", error);
    return { status: "error", message: "No pudimos abrir el caso. Probá de nuevo." };
  }
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/support");
  return { status: "saved", message: "Caso abierto. Nuestro equipo lo va a revisar." };
}
