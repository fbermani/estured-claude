import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFeeInstructionsForPayer } from "@/lib/payments/paymentSettings";

const SETTINGS_ROW = {
  id: "ps-1",
  account_holder: "EstuRed (datos de prueba)",
  alias: "estured.demo.cobro",
  cbu: "0000000000000000000000",
  bank_name: "Banco Demo",
  holder_cuit: null,
  instructions: null,
  updated_by_user_id: "admin-1",
  updated_at: "2026-10-21T12:00:00Z",
};

/** Cliente falso: cada tabla responde con su fila fija; registra qué tablas se leyeron. */
function fakeAdmin(tables: Record<string, unknown>) {
  const reads: string[] = [];
  const client = {
    from(table: string) {
      reads.push(table);
      const result = { data: tables[table] ?? null, error: null };
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve(result);
      return chain;
    },
  };
  return { admin: client as unknown as SupabaseClient, reads };
}

const FEE = { status: "pending_payment_method", payer_user_id: "payer-1" };

describe("loadFeeInstructionsForPayer", () => {
  it("entrega los datos al pagador designado (aunque sea el propio estudiante)", async () => {
    const { admin } = fakeAdmin({ estured_fee_payments: FEE, payment_settings: SETTINGS_ROW });
    const result = await loadFeeInstructionsForPayer(admin, { userId: "payer-1", feePaymentId: "fee-1" });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.instructions.alias).toBe("estured.demo.cobro");
      // No se filtra nada de auditoría al cliente.
      expect(Object.keys(result.instructions)).not.toContain("updated_by_user_id");
    }
  });

  it("niega al estudiante beneficiario si el pagador designado es otra persona", async () => {
    const { admin, reads } = fakeAdmin({ estured_fee_payments: FEE, student_profiles: { user_id: "student-1" }, payment_settings: SETTINGS_ROW });
    const result = await loadFeeInstructionsForPayer(admin, { userId: "student-1", feePaymentId: "fee-1" });
    expect(result.status).toBe("forbidden");
    expect(reads).not.toContain("payment_settings");
  });

  it("niega a cualquier otro usuario y ni siquiera lee la configuración", async () => {
    const { admin, reads } = fakeAdmin({ estured_fee_payments: FEE, student_profiles: { user_id: "student-1" }, payment_settings: SETTINGS_ROW });
    const result = await loadFeeInstructionsForPayer(admin, { userId: "intruder", feePaymentId: "fee-1" });
    expect(result.status).toBe("forbidden");
    expect(reads).not.toContain("payment_settings");
  });

  it("niega si el fee ya no está pendiente de pago", async () => {
    const { admin, reads } = fakeAdmin({
      estured_fee_payments: { ...FEE, status: "paid" },
      payment_settings: SETTINGS_ROW,
    });
    const result = await loadFeeInstructionsForPayer(admin, { userId: "payer-1", feePaymentId: "fee-1" });
    expect(result.status).toBe("forbidden");
    expect(reads).not.toContain("payment_settings");
  });

  it("devuelve not_configured si el admin todavía no cargó los datos", async () => {
    const { admin } = fakeAdmin({ estured_fee_payments: FEE });
    const result = await loadFeeInstructionsForPayer(admin, { userId: "payer-1", feePaymentId: "fee-1" });
    expect(result.status).toBe("not_configured");
  });
});
