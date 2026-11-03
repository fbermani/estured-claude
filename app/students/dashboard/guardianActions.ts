"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveGuardianConfirmation } from "@/lib/residents/guardianConfirmation";

export type GuardianDecisionResult = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El tutor confirma o rechaza la estadía de un menor (DR32). Validación server-side: sesión, id válido y, dentro de
 * `resolveGuardianConfirmation`, vínculo familiar ACTIVO con ese estudiante, estado `pending` y plazo vigente.
 */
export async function resolveGuardianConfirmationAction(input: { confirmationId: string; decision: "confirm" | "reject" }): Promise<GuardianDecisionResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { ok: false, message: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (typeof input?.confirmationId !== "string" || !UUID.test(input.confirmationId) || (input.decision !== "confirm" && input.decision !== "reject")) {
    return { ok: false, message: "No pudimos procesar la respuesta. Actualizá la página e intentá de nuevo." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "No disponible en este momento. Probá más tarde." };
  const result = await resolveGuardianConfirmation(admin, { actorUserId: sessionUser.id, confirmationId: input.confirmationId, decision: input.decision });
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/students/dashboard");
  return { ok: true };
}
