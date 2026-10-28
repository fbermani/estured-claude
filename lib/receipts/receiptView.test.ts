import { describe, expect, it } from "vitest";
import { buildReceiptRows, type ReceiptPayload } from "@/lib/receipts/receiptView";

const payload: ReceiptPayload = {
  student: { first_name: "Lucía", last_initial: "F." },
  residence: { name: "Residencia Norte", public_area: "Palermo" },
  room_type: "Individual",
  desired_start_date: "2026-08-15",
  initial_duration_months: 6,
  final_conditions: {
    monthly_price_usd: "300.00",
    monthly_price_ars: "444000.00",
    enrollment_fee_usd: "50.00",
    enrollment_fee_ars: "74000.00",
    deposit_usd: "300.00",
    deposit_ars: "444000.00",
    exchange_rate_ars_per_usd: "1480.000000",
    exchange_rate_date: "2026-07-01",
    adjustment_policy: "quarterly",
  },
  residence_payment: { amount_usd: 350, amount_ars: 518000 },
  estured_fee: { amount_ars: 140500, currency: "ARS", paid_at: "2026-07-09T12:00:00.000Z" },
  adjustment_policy: "quarterly",
};

const byLabel = (rows: ReturnType<typeof buildReceiptRows>) => Object.fromEntries(rows.map((r) => [r.label, r.value]));

describe("buildReceiptRows", () => {
  it("incluye lo que pide docs/01 §14 cuando los datos existen", () => {
    const rows = byLabel(buildReceiptRows(payload, {}, "2026-07-09T12:00:00.000Z"));
    expect(rows["Estudiante"]).toBe("Lucía F.");
    expect(rows["Fecha de ingreso"]).toBe("15/08/2026");
    expect(rows["Tarifa mensual acordada"]).toContain("USD 300");
    expect(rows["Tarifa mensual acordada"]).toContain("ARS");
    expect(rows["Matrícula (no reembolsable)"]).toContain("USD 50");
    expect(rows["Depósito (reembolsable)"]).toContain("USD 300");
    expect(rows["Política de ajustes"]).toBe("Ajuste trimestral");
    expect(rows["Pago a la residencia (informado por la residencia)"]).toContain("USD 350");
    expect(rows["Tipo de cambio de referencia"]).toContain("1.480");
    expect(rows["Tipo de cambio de referencia"]).toContain("01/07/2026");
    expect(rows["Fee EstuRed pagado"]).toBe("ARS 140.500");
    expect(rows["Emitido"]).toBeDefined();
  });

  it("no inventa filas cuando faltan datos (comprobante viejo)", () => {
    const rows = byLabel(
      buildReceiptRows({ student: { first_name: "Ana", last_initial: "G." }, room_type: "Doble" }),
    );
    expect(Object.keys(rows)).toEqual(["Estudiante", "Tipo de habitación"]);
  });

  it("usa el suplemento para el monto informado por la residencia si el payload no lo guardó", () => {
    const { residence_payment: _omit, ...legacy } = payload;
    void _omit;
    const rows = byLabel(buildReceiptRows(legacy, { residencePayment: { usd: null, ars: 520000 } }));
    expect(rows["Pago a la residencia (informado por la residencia)"]).toBe("ARS 520.000");
  });

  it("muestra el familiar pagador solo si se informa", () => {
    expect(byLabel(buildReceiptRows(payload, {}))["Fee pagado por (familiar)"]).toBeUndefined();
    expect(byLabel(buildReceiptRows(payload, { familyPayerName: "Martín Fernández" }))["Fee pagado por (familiar)"]).toBe(
      "Martín Fernández",
    );
  });

  it("matrícula y depósito en 0 no se muestran", () => {
    const rows = byLabel(
      buildReceiptRows({ final_conditions: { ...payload.final_conditions, enrollment_fee_usd: 0, deposit_usd: null } }),
    );
    expect(rows["Matrícula (no reembolsable)"]).toBeUndefined();
    expect(rows["Depósito (reembolsable)"]).toBeUndefined();
  });

  it("si el fee se pagó en USD lo muestra en USD", () => {
    const rows = byLabel(
      buildReceiptRows({ estured_fee: { amount_ars: 140500, amount_usd: 95, currency: "USD" } }),
    );
    expect(rows["Fee EstuRed pagado"]).toBe("USD 95");
  });
});

describe("buildReceiptRows con suplemento del snapshot (comprobantes viejos)", () => {
  it("completa tipo de cambio, ajustes y depósito desde el snapshot cuando el payload no los guardó", () => {
    const rows = byLabel(
      buildReceiptRows(
        { student: { first_name: "Camila", last_initial: "R." }, final_conditions: { monthly_price_usd: 300 } },
        {
          snapshot: {
            monthly_price_ars: "456000",
            deposit_usd: "300",
            deposit_ars: "456000",
            exchange_rate_ars_per_usd: "1520",
            exchange_rate_date: "2026-07-01",
            adjustment_policy: "semiannual",
          },
        },
      ),
    );
    expect(rows["Tarifa mensual acordada"]).toBe("USD 300 · ARS 456.000");
    expect(rows["Depósito (reembolsable)"]).toBe("USD 300 · ARS 456.000");
    expect(rows["Política de ajustes"]).toBe("Ajuste semestral");
    expect(rows["Tipo de cambio de referencia"]).toBe("ARS 1.520 por USD (al 01/07/2026)");
  });

  it("el payload congelado manda sobre el snapshot", () => {
    const rows = byLabel(
      buildReceiptRows(
        { final_conditions: { monthly_price_usd: 300 } },
        { snapshot: { monthly_price_usd: 999 } },
      ),
    );
    expect(rows["Tarifa mensual acordada"]).toBe("USD 300");
  });
});

describe("buildReceiptRows con mes vacío (DR18 t4)", () => {
  it("muestra el mes vacío confirmado con su cantidad", () => {
    const rows = byLabel(
      buildReceiptRows({
        final_conditions: { monthly_price_usd: 400, empty_months_charge_usd: "300", empty_months_count: "1.5", exchange_rate_ars_per_usd: "1000" },
      }),
    );
    expect(rows["Mes vacío (1,5 meses)"]).toBe("USD 300 · ARS 300.000");
  });
  it("sin cargo no agrega la fila", () => {
    const rows = byLabel(buildReceiptRows({ final_conditions: { monthly_price_usd: 400, empty_months_charge_usd: null } }));
    expect(Object.keys(rows).some((k) => k.startsWith("Mes vacío"))).toBe(false);
  });
});

