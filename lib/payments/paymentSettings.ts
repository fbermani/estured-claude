import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lectura de los datos de cobro (`payment_settings`, migración 0038). Solo
 * server: la tabla tiene RLS sin policies, se accede con service role.
 */

export type PaymentSettingsRow = {
  id: string;
  account_holder: string;
  alias: string;
  cbu: string;
  bank_name: string;
  holder_cuit: string | null;
  instructions: string | null;
  updated_by_user_id: string | null;
  updated_at: string;
};

/** Lo único que se entrega al cliente para pagar: nada de ids ni auditoría. */
export type PaymentInstructions = {
  accountHolder: string;
  alias: string;
  cbu: string;
  bankName: string;
  holderCuit: string | null;
  instructions: string | null;
};

const COLUMNS = "id, account_holder, alias, cbu, bank_name, holder_cuit, instructions, updated_by_user_id, updated_at";

/** Fila completa para el admin; `null` si no se cargó nada (o la tabla todavía no existe). */
export async function loadPaymentSettings(admin: SupabaseClient): Promise<PaymentSettingsRow | null> {
  const { data, error } = await admin.from("payment_settings").select(COLUMNS).maybeSingle();
  if (error) {
    console.error("[payment-settings] read failed:", error);
    return null;
  }
  return (data as PaymentSettingsRow | null) ?? null;
}

export function toPaymentInstructions(row: PaymentSettingsRow): PaymentInstructions {
  return {
    accountHolder: row.account_holder,
    alias: row.alias,
    cbu: row.cbu,
    bankName: row.bank_name,
    holderCuit: row.holder_cuit,
    instructions: row.instructions,
  };
}

export type FeeInstructionsResult =
  | { status: "ready"; instructions: PaymentInstructions }
  | { status: "not_configured" }
  | { status: "forbidden" };

/**
 * Datos de cobro para UNA reserva, solo si `userId` es el pagador designado
 * del fee (`estured_fee_payments.payer_user_id`: quien envió la solicitud, el
 * estudiante o su familiar vinculado) y el fee sigue pendiente de pago
 * (`pending_payment_method`). Cualquier otro caso devuelve `forbidden` sin
 * leer la configuración: el estudiante beneficiario no ve la cuenta si el
 * pagador es otra persona.
 */
export async function loadFeeInstructionsForPayer(
  admin: SupabaseClient,
  input: { userId: string; feePaymentId: string },
): Promise<FeeInstructionsResult> {
  const { data: fee } = await admin
    .from("estured_fee_payments")
    .select("status, payer_user_id")
    .eq("id", input.feePaymentId)
    .maybeSingle();
  if (!fee || fee.status !== "pending_payment_method" || fee.payer_user_id !== input.userId) {
    return { status: "forbidden" };
  }

  const row = await loadPaymentSettings(admin);
  return row ? { status: "ready", instructions: toPaymentInstructions(row) } : { status: "not_configured" };
}
