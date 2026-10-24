"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adminActorRole, getAdminSession } from "@/lib/auth/requireAdmin";
import { resolveFeeRevocation } from "@/lib/revocations/resolveFeeRevocation";

export type ResolveRevocationState = { status: "idle" | "error" | "saved"; message?: string };

function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * Capa fina de "Resolver revocación" (DR6, docs/07 §18.6bis): comprueba que sea admin/superadmin, parsea el `FormData` y delega
 * toda la lógica (y la validación server-side) a `resolveFeeRevocation`. La decisión llega en el `name`/`value` nativo del botón
 * que se apretó ("refunded" / "denied"), nunca por estado del cliente.
 */
export async function resolveRevocationAction(
  reservationId: string,
  _prev: ResolveRevocationState,
  formData: FormData,
): Promise<ResolveRevocationState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "No tenés permiso para esta acción." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await resolveFeeRevocation(admin, {
    reservationId,
    actorUserId: sessionUser.id,
    actorRole: adminActorRole(sessionUser),
    input: {
      decision: String(formData.get("decision") ?? ""),
      internalReason: String(formData.get("internal_reason") ?? ""),
      studentMessage: String(formData.get("student_message") ?? "") || null,
      confirmRefundAmountArs: parseAmount(formData.get("confirm_refund_amount_ars")),
      refundMethod: String(formData.get("refund_method") ?? "") || null,
      refundReference: String(formData.get("refund_reference") ?? "") || null,
      refundedOn: String(formData.get("refunded_on") ?? "") || null,
      justifiedCause: formData.get("justified_cause") === "on",
      confirmDenial: formData.get("confirm_denial") === "on",
      acknowledgeUsdRefund: formData.get("acknowledge_usd_refund") === "on",
    },
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/admin/activity");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/support-cases");
  revalidatePath("/students/revocation");
  return { status: "saved" };
}
