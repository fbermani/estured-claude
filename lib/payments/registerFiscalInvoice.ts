import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { normalizeFacturaCNumber, validateInvoiceDate } from "@/lib/payments/fiscalInvoice";

/**
 * LEG-002 (Ola 0 legal): el admin registra el número de la Factura C que emitió a mano en ARCA para un fee cobrado. Queda en
 * `estured_fee_payments.fiscal_invoice_*` (la reserva la ve por `reservations.estured_fee_payment_id`). Solo para fees `paid` con la
 * factura `pending_issue`; escritura condicional (dos admins a la vez no pisan un número). No se permite repetir un número.
 */
export async function registerFiscalInvoice(
  admin: SupabaseClient,
  params: { feePaymentId: string; invoiceNumber: unknown; issuedOn: unknown; actorUserId: string; actorRole: "admin" | "superadmin"; now?: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const number = normalizeFacturaCNumber(params.invoiceNumber);
  if (!number.ok) return number;

  const { data: fee, error } = await admin
    .from("estured_fee_payments")
    .select("id, status, paid_at, fiscal_invoice_status")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (error) {
    console.error("[fiscal-invoice] fee read failed:", error.code);
    return { ok: false, error: "No pudimos leer el pago. Intentá de nuevo." };
  }
  if (!fee) return { ok: false, error: "No encontramos ese pago." };
  if (fee.status !== "paid") return { ok: false, error: "Solo se factura un fee cobrado." };
  if (fee.fiscal_invoice_status !== "pending_issue") return { ok: false, error: "Este fee ya tiene la factura registrada." };

  const date = validateInvoiceDate(params.issuedOn, (fee.paid_at as string | null) ?? null, params.now);
  if (!date.ok) return date;

  const { data: duplicate, error: dupError } = await admin
    .from("estured_fee_payments")
    .select("id")
    .eq("fiscal_invoice_number", number.value)
    .neq("id", fee.id)
    .limit(1);
  if (dupError) {
    console.error("[fiscal-invoice] duplicate check failed:", dupError.code);
    return { ok: false, error: "No pudimos registrar la factura. Intentá de nuevo." };
  }
  if ((duplicate ?? []).length > 0) return { ok: false, error: "Ese número de factura ya está registrado en otro fee." };

  const { data: rows, error: updateError } = await admin
    .from("estured_fee_payments")
    .update({
      fiscal_invoice_status: "issued",
      fiscal_invoice_number: number.value,
      fiscal_invoice_issued_at: new Date(`${date.value}T12:00:00-03:00`).toISOString(),
      fiscal_invoice_last_error: null,
    })
    .eq("id", fee.id)
    .eq("status", "paid")
    .eq("fiscal_invoice_status", "pending_issue")
    .select("id");
  if (updateError || !rows || rows.length === 0) {
    if (updateError) console.error("[fiscal-invoice] update failed:", updateError.code);
    return { ok: false, error: "No pudimos registrar la factura: el pago cambió. Actualizá la página." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "fiscal_invoice_recorded",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    newValue: { fiscal_invoice_number: number.value, issued_on: date.value, manual: true },
  });
  return { ok: true };
}
