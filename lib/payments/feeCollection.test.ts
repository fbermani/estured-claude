import { describe, expect, it } from "vitest";
import {
  composeSettingsDetails,
  compareByCatalog,
  describeFeeMethodChange,
  feeAmountInCurrency,
  feeMethodAuditView,
  isFeeCurrency,
  isFeeIssueOpen,
  splitFeeSnapshot,
  buildFeeInstructionsSnapshot,
} from "@/lib/payments/feeCollection";
import { feeRegistrationBlocker, CHOOSE_METHOD_FIRST } from "@/lib/payments/registerFeePayment";
import { feeStageBlocker } from "@/lib/payments/feePayerActions";

/** DR64: lógica pura del cobro del fee con medios del catálogo. */
const FEE = { fee_amount_ars: 70000, fee_amount_usd: null, fee_base_usd: 1000, fee_base_ars: 1_400_000 };

describe("monto del fee en la moneda del medio", () => {
  it("ARS: el guardado", () => {
    expect(feeAmountInCurrency(FEE, "ARS")).toBe(70000);
  });
  it("USD: fee_amount_ars ÷ cotización del snapshot (fee_base_ars ÷ fee_base_usd)", () => {
    expect(feeAmountInCurrency(FEE, "USD")).toBe(50);
  });
  it("USD: usa el fee_amount_usd guardado si existe", () => {
    expect(feeAmountInCurrency({ ...FEE, fee_amount_usd: "48.5" }, "USD")).toBe(48.5);
  });
  it("sin base para derivar la cotización devuelve null en USD", () => {
    expect(feeAmountInCurrency({ ...FEE, fee_base_ars: null, fee_base_usd: null }, "USD")).toBeNull();
  });
});

describe("snapshot de datos de cobro", () => {
  it("congela «medio\\ndatos» y se puede volver a separar", () => {
    const snap = buildFeeInstructionsSnapshot("transfer_ars", { methodLabel: null, details: "CBU 000\nAlias: estured" });
    expect(snap).toEqual({ ok: true, value: "Transferencia en pesos\nCBU 000\nAlias: estured" });
    expect(splitFeeSnapshot("Transferencia en pesos\nCBU 000\nAlias: estured")).toEqual({ label: "Transferencia en pesos", details: "CBU 000\nAlias: estured" });
  });
  it("sin datos no se congela", () => {
    expect(buildFeeInstructionsSnapshot("belo", { methodLabel: null, details: "  " }).ok).toBe(false);
  });
  it("«Otro» usa el nombre libre", () => {
    const snap = buildFeeInstructionsSnapshot("other", { methodLabel: "Cripto", details: "wallet" });
    expect(snap).toEqual({ ok: true, value: "Cripto\nwallet" });
  });
});

describe("cuenta de payment_settings como medio", () => {
  it("compone el texto sin omitir ningún dato", () => {
    const text = composeSettingsDetails({ account_holder: "EstuRed SAS", bank_name: "Banco X", alias: "estured.cobro", cbu: "0".repeat(22), holder_cuit: "30123456789", instructions: "Poné la referencia." });
    expect(text).toContain("Titular: EstuRed SAS");
    expect(text).toContain(`CBU: ${"0".repeat(22)}`);
    expect(text).toContain("CUIT/CUIL del titular: 30123456789");
    expect(text).toContain("Indicaciones: Poné la referencia.");
  });
  it("sin CUIT ni indicaciones no agrega esas líneas", () => {
    const text = composeSettingsDetails({ account_holder: "A", bank_name: "B", alias: "c.d.e.f.g", cbu: "1", holder_cuit: null, instructions: null });
    expect(text.split("\n")).toHaveLength(4);
  });
});

describe("cambios de un medio (sin valores)", () => {
  const base = { method_key: "transfer_ars", method_label: null, currency: "ARS", is_enabled: true, details: "CBU 1" };
  it("alta", () => {
    expect(describeFeeMethodChange(null, base)).toEqual(["Se cargó y habilitó «Transferencia en pesos»."]);
  });
  it("deshabilitar y cambiar datos no muestran los datos", () => {
    const out = describeFeeMethodChange(base, { ...base, is_enabled: false, details: "CBU 2" });
    expect(out).toEqual(["Se deshabilitó «Transferencia en pesos».", "Cambiaron los datos de cobro de «Transferencia en pesos»."]);
    expect(out.join(" ")).not.toContain("CBU");
  });
  it("sin cambios devuelve vacío", () => {
    expect(describeFeeMethodChange(base, { ...base })).toEqual([]);
  });
  it("la vista de auditoría enmascara los datos", () => {
    const view = feeMethodAuditView({ ...base, details: "CBU 0000000000000000001234" });
    expect(view.details).toBe("•••• 1234");
  });
});

describe("utilidades", () => {
  it("moneda válida y orden del catálogo", () => {
    expect(isFeeCurrency("ARS")).toBe(true);
    expect(isFeeCurrency("EUR")).toBe(false);
    expect(["belo", "transfer_ars", "cash"].sort(compareByCatalog)).toEqual(["cash", "transfer_ars", "belo"]);
  });
  it("aviso abierto = hay aviso y no hay resolución", () => {
    expect(isFeeIssueOpen({ student_payment_issue_at: "2026-11-21T00:00:00Z", student_payment_issue_resolved_at: null })).toBe(true);
    expect(isFeeIssueOpen({ student_payment_issue_at: "2026-11-21T00:00:00Z", student_payment_issue_resolved_at: "2026-11-21T01:00:00Z" })).toBe(false);
    expect(isFeeIssueOpen({ student_payment_issue_at: null, student_payment_issue_resolved_at: null })).toBe(false);
  });
});

describe("reglas de estado del pagador", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const open = { status: "pending_payment_method", expires_at: "2030-01-01T00:00:00Z" };
  it("vigente: sin bloqueo", () => expect(feeStageBlocker(open, now)).toBeNull());
  it("vencido: bloquea", () => expect(feeStageBlocker({ ...open, expires_at: "2020-01-01T00:00:00Z" }, now)).toMatch(/venció/));
  it("ya informado: bloquea", () => expect(feeStageBlocker({ ...open, status: "pending_manual_payment" }, now)).toMatch(/Ya informaste/));
  it("«Ya pagué» exige medio elegido", () => {
    expect(feeRegistrationBlocker({ ...open, chosen_method: null, student_payment_issue_at: null, student_payment_issue_resolved_at: null }, now)).toBe(CHOOSE_METHOD_FIRST);
    expect(feeRegistrationBlocker({ ...open, chosen_method: "belo", student_payment_issue_at: null, student_payment_issue_resolved_at: null }, now)).toBeNull();
  });
  it("«Ya pagué» se rechaza con un aviso abierto y se permite con el aviso ya respondido", () => {
    const issue = { ...open, chosen_method: "belo", student_payment_issue_at: "2026-11-21T00:00:00Z" };
    expect(feeRegistrationBlocker({ ...issue, student_payment_issue_resolved_at: null }, now)).toMatch(/Esperá la respuesta/);
    expect(feeRegistrationBlocker({ ...issue, student_payment_issue_resolved_at: "2026-11-21T01:00:00Z" }, now)).toBeNull();
  });
});
