import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type ReissueBookingReceiptResult =
  | { ok: true; newReceiptId: string; newReceiptNumber: string }
  | { ok: false; error: string };

/**
 * Docs/03 §26 (caso de QA obligatorio: "admin reemite comprobante →
 * auditoría registrada") + schema de `booking_receipts` (migración 0011:
 * `receipt_status` ya incluye `'reissued'`, y `reissued_from_receipt_id`
 * ya existe) — la reemisión siempre es iniciada por un admin, nunca
 * automática. El comprobante viejo pasa a `'reissued'` (no se anula:
 * `voided` es un estado distinto, para cuando la reserva se cancela) y
 * se crea uno nuevo con número/código de verificación/QR nuevos, mismos
 * datos congelados (la reemisión no re-calcula condiciones — es una
 * copia con nueva identidad de documento, no una nueva emisión sobre
 * datos actuales).
 */
export async function reissueBookingReceipt(
  admin: SupabaseClient,
  params: { receiptId: string; actorUserId: string; actorRole: string; reason: string },
): Promise<ReissueBookingReceiptResult> {
  if (!params.reason.trim()) {
    return { ok: false, error: "El motivo es obligatorio para reemitir un comprobante." };
  }

  const { data: oldReceipt } = await admin
    .from("booking_receipts")
    .select("id, status, reservation_id, student_profile_id, payer_user_id, residence_id, receipt_payload")
    .eq("id", params.receiptId)
    .maybeSingle();
  if (!oldReceipt) return { ok: false, error: "No encontramos ese comprobante." };
  if (oldReceipt.status !== "issued") {
    return { ok: false, error: "Solo se puede reemitir un comprobante vigente (emitido)." };
  }

  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verificationCode = crypto.randomUUID();
  const receiptNumber = `ER-${now.getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const payload = { ...(oldReceipt.receipt_payload as Record<string, unknown>), issued_at: now.toISOString() };

  const { data: newReceipt, error: insertError } = await admin
    .from("booking_receipts")
    .insert({
      reservation_id: oldReceipt.reservation_id,
      student_profile_id: oldReceipt.student_profile_id,
      payer_user_id: oldReceipt.payer_user_id,
      residence_id: oldReceipt.residence_id,
      status: "issued",
      receipt_number: receiptNumber,
      verification_code: verificationCode,
      qr_code_value: `${appUrl}/verify/${verificationCode}`,
      issued_at: now.toISOString(),
      reissued_from_receipt_id: oldReceipt.id,
      receipt_payload: payload,
    })
    .select("id")
    .single();
  if (insertError || !newReceipt) {
    console.error("[receipts] reissue insert failed:", insertError);
    return { ok: false, error: "No pudimos generar el nuevo comprobante. Intentá de nuevo." };
  }

  const { error: oldUpdateError } = await admin
    .from("booking_receipts")
    .update({ status: "reissued" })
    .eq("id", oldReceipt.id);
  if (oldUpdateError) {
    console.error("[receipts] old receipt status update failed:", oldUpdateError);
    return { ok: false, error: "No pudimos actualizar el comprobante anterior. Intentá de nuevo." };
  }

  await admin
    .from("reservations")
    .update({ booking_receipt_id: newReceipt.id })
    .eq("id", oldReceipt.reservation_id);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "booking_receipt_reissued",
    entityType: "booking_receipts",
    entityId: oldReceipt.id,
    newValue: { new_receipt_id: newReceipt.id, new_receipt_number: receiptNumber },
    reasonText: params.reason,
    source: "admin",
  });

  return { ok: true, newReceiptId: newReceipt.id, newReceiptNumber: receiptNumber };
}
