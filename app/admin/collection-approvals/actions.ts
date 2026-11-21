"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/requireAdmin";
import { approveCollectionAccount, rejectCollectionAccount } from "@/lib/residences/collectionApproval";

export type CollectionReviewState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Aprobar o rechazar los datos de cobro de la reserva de UN medio (DR63 (j) 5). Acción fina: el rol (admin o superadmin), la validación,
 * la condición por `pending_submitted_at` (lo que el admin vio), la auditoría enmascarada y el aviso al dueño viven en
 * `lib/residences/collectionApproval`. La decisión sale del botón (`name="intent"`), nunca de un estado de cliente.
 */
export async function reviewCollectionAccount(_prev: CollectionReviewState, formData: FormData): Promise<CollectionReviewState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "No tenés permiso para esta acción." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const intent = String(formData.get("intent") ?? "");
  if (intent !== "approve" && intent !== "reject") return { status: "error", message: "Acción inválida." };
  const common = {
    actorUserId: sessionUser.id,
    residenceId: String(formData.get("residence_id") ?? ""),
    methodKey: String(formData.get("method_key") ?? ""),
    expectedSubmittedAt: String(formData.get("expected_submitted_at") ?? ""),
  };

  const result =
    intent === "approve"
      ? await approveCollectionAccount(admin, common)
      : await rejectCollectionAccount(admin, { ...common, reason: formData.get("reason") });
  if (!result.ok) return { status: "error", message: result.error };

  // La cola (`/admin/collection-approvals`) NO se revalida acá: la tarjeta muestra el resultado y se refresca sola un instante después.
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/verifications");
  revalidatePath(`/residence/${common.residenceId}/collection`);
  revalidatePath(`/residence/${common.residenceId}/profile`);
  return {
    status: "saved",
    message: intent === "approve" ? `Aprobaste los datos de ${result.method}. Ya rigen.` : `Rechazaste los datos de ${result.method}. El dueño ve el motivo.`,
  };
}
