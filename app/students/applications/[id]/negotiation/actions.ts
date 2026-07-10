"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { recordNegotiationResponse } from "@/lib/applications/recordNegotiationResponse";

export type RespondProposalState = { status: "idle" | "error"; message?: string };

/**
 * Capa fina (docs/07 §15.5) — resuelve sesión y delega toda la lógica
 * de negocio a `recordNegotiationResponse` (extraída en el Ciclo 21,
 * GAPS.md, para que sea testeable sin `next/headers`). `redirect()`
 * queda acá porque solo funciona dentro del ciclo de vida real de un
 * Server Action.
 */
export async function respondNegotiationProposal(
  applicationId: string,
  response: "accepted" | "rejected_chose_original" | "rejected_closed",
): Promise<RespondProposalState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await recordNegotiationResponse(admin, {
    applicationId,
    response,
    actorUserId: sessionUser.id,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/applications/${applicationId}`);
  redirect(`/students/applications/${applicationId}`);
}
