"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { openFeePaymentSupportCase, openSupportCase, type OpenSupportCaseResult } from "@/lib/support/openSupportCase";

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

  // Misma regla que la lista del formulario: solo residencias con las que el estudiante tiene una solicitud o reserva.
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) return { status: "error", message: "Completá tu perfil de estudiante para abrir un caso." };
  const [{ data: apps }, { data: reservations }] = await Promise.all([
    admin.from("application_requests").select("id").eq("student_profile_id", studentProfile.id).eq("residence_id", residenceId).limit(1),
    admin.from("reservations").select("id").eq("student_profile_id", studentProfile.id).eq("residence_id", residenceId).limit(1),
  ]);
  if (!apps?.length && !reservations?.length) {
    return { status: "error", message: "Solo podés abrir un caso sobre una residencia con la que tengas una solicitud o reserva." };
  }

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

/**
 * "Tengo un problema con el pago" (D2 / H02): caso dirigido a EstuRed, que es
 * quien cobra el fee. Sin residencia ni recordatorio de deslinde.
 */
export async function openFeePaymentCase(_prev: OpenCaseState, formData: FormData): Promise<OpenCaseState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  let result: OpenSupportCaseResult;
  try {
    result = await openFeePaymentSupportCase(admin, {
      actorUserId: sessionUser.id,
      actorRole: sessionUser.primaryRole,
      reservationId: String(formData.get("reservation_id") ?? ""),
      description: String(formData.get("description") ?? ""),
      evidenceFiles: formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0),
    });
  } catch (error) {
    console.error("[support] openFeePaymentCase failed:", error);
    return { status: "error", message: "No pudimos enviar tu consulta. Probá de nuevo." };
  }
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/support");
  return { status: "saved", message: "Listo, le escribiste a EstuRed. Te respondemos desde acá, en \"Tus casos\"." };
}
