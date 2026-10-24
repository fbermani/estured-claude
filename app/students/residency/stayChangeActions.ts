"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createStayChangeIntent } from "@/lib/stayChange/createStayChangeIntent";
import { updateStayChangeIntent } from "@/lib/stayChange/updateStayChangeIntent";
import { cancelStayChangeIntent } from "@/lib/stayChange/cancelStayChangeIntent";
import { confirmStayChangeIntentByFamily, confirmStillSearching, markStayChangeResponseSeen } from "@/lib/stayChange/studentFollowUps";
import { isChecked } from "@/lib/stayChange/validate";
import { saveStudentExitNote } from "@/lib/stayChange/recordEarlyExit";

/**
 * Acciones del aviso "Quiero cambiar" (DR3, Ciclo 59) del lado estudiante/familiar. Toda la lógica y la validación
 * viven en `lib/stayChange/*` (testeable sin `next/headers`); acá solo sesión, FormData y revalidación.
 * El estado es el mismo para `useActionState`: `idle | error | saved`, con `message` accionable en voseo.
 */
export type StayChangeActionState = {
  status: "idle" | "error" | "saved";
  message?: string;
  /** Solo al cancelar: lo que se cerró. */
  closedApplications?: number;
  closedWaitlist?: number;
  /** Solo al cancelar bloqueado: solicitudes con pago en curso (para el enlace "Ver solicitud"). */
  blockingApplicationIds?: string[];
};

const SESSION_EXPIRED: StayChangeActionState = { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
const UNAVAILABLE: StayChangeActionState = { status: "error", message: "No disponible en este momento. Probá más tarde." };

function refresh() {
  revalidatePath("/students/residency");
  revalidatePath("/students/dashboard");
  revalidatePath("/students/applications");
  revalidatePath("/students/waitlist");
}

export async function createStayChangeIntentAction(
  _prev: StayChangeActionState,
  formData: FormData,
): Promise<StayChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;

  const result = await createStayChangeIntent(admin, {
    actorUserId: sessionUser.id,
    estimatedExitDate: formData.get("estimated_exit_date"),
    studentMessage: formData.get("student_message"),
    confirmed: isChecked(formData.get("confirm_understood")),
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return {
    status: "saved",
    message:
      result.status === "open"
        ? "Le avisamos a tu residencia. Ya podés buscar con fechas que se superponen."
        : "Guardamos tu aviso. Cuando tu familiar lo confirme, se lo enviamos a tu residencia.",
  };
}

export async function updateStayChangeIntentAction(
  intentId: string,
  _prev: StayChangeActionState,
  formData: FormData,
): Promise<StayChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;

  const result = await updateStayChangeIntent(admin, {
    actorUserId: sessionUser.id,
    intentId,
    estimatedExitDate: formData.get("estimated_exit_date"),
    studentMessage: formData.get("student_message"),
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: "Actualizamos tu aviso." };
}

export async function cancelStayChangeIntentAction(
  intentId: string,
  _prev: StayChangeActionState,
): Promise<StayChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;

  const result = await cancelStayChangeIntent(admin, { actorUserId: sessionUser.id, intentId });
  if (!result.ok) return { status: "error", message: result.error, blockingApplicationIds: result.blockingApplicationIds };
  refresh();
  return {
    status: "saved",
    message: "Cancelaste tu aviso de cambio. Tu reserva sigue igual.",
    closedApplications: result.closedApplications,
    closedWaitlist: result.closedWaitlist,
  };
}

/** "Seguir buscando" (recordatorio del día 80): extiende el aviso 90 días. */
export async function confirmStillSearchingAction(intentId: string, _prev: StayChangeActionState): Promise<StayChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;

  const result = await confirmStillSearching(admin, { actorUserId: sessionUser.id, intentId });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: "Listo, seguimos con tu aviso 90 días más." };
}

/** Se registra al mostrarse la respuesta de la residencia al estudiante. No falla en voz alta: es un efecto secundario. */
export async function markStayChangeResponseSeenAction(intentId: string): Promise<void> {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) return;
  await markStayChangeResponseSeen(admin, { actorUserId: sessionUser.id, intentId });
}

/** Menores: el familiar vinculado confirma el aviso que inició el menor. */
export async function confirmStayChangeIntentByFamilyAction(
  intentId: string,
  _prev: StayChangeActionState,
): Promise<StayChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;

  const result = await confirmStayChangeIntentByFamily(admin, { actorUserId: sessionUser.id, intentId });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: "Confirmaste el aviso. Se lo enviamos a la residencia." };
}

/** El estudiante deja (o edita) su nota sobre su salida anticipada, ya registrada por su residencia. */
export async function saveStayExitStudentNoteAction(
  residentStayId: string,
  _prev: StayChangeActionState,
  formData: FormData,
): Promise<StayChangeActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return SESSION_EXPIRED;
  const admin = getSupabaseAdmin();
  if (!admin) return UNAVAILABLE;

  const result = await saveStudentExitNote(admin, { actorUserId: sessionUser.id, residentStayId, note: formData.get("student_note") });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: "Guardamos tu nota." };
}
