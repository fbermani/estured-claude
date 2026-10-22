"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { reissueBookingReceipt } from "@/lib/receipts/reissueBookingReceipt";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type ReissueReceiptState = { status: "idle" | "error" | "saved"; message?: string };

export async function reissueReceiptAction(
  receiptId: string,
  _prev: ReissueReceiptState,
  formData: FormData,
): Promise<ReissueReceiptState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "No tenés permiso para esta acción." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const reason = String(formData.get("reason") ?? "").trim();

  const result = await reissueBookingReceipt(admin, {
    receiptId,
    actorUserId: sessionUser.id,
    actorRole: "admin",
    reason,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/admin/receipts");
  revalidatePath("/admin/activity");
  return { status: "saved", message: `Comprobante reemitido: N.º ${result.newReceiptNumber}.` };
}
