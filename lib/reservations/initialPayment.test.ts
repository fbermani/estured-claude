import { describe, expect, it } from "vitest";
import {
  buildInitialPayment,
  describeInitialPaymentForLog,
  resolveNegotiatedInitialPaymentUsd,
  estimatedFeeUsd,
  formatInitialPaymentLine,
  initialPaymentConfigFromRow,
  normalizeInitialPaymentMode,
  parseInitialPaymentInput,
  resolveInitialPaymentUsd,
} from "@/lib/reservations/initialPayment";

const fmt = (usd: number) => `USD ${usd}`;

describe("normalizeInitialPaymentMode / initialPaymentConfigFromRow", () => {
  it("residencias sin el campo o con valor desconocido usan el primer mes", () => {
    expect(normalizeInitialPaymentMode(undefined)).toBe("one_month");
    expect(normalizeInitialPaymentMode(null)).toBe("one_month");
    expect(normalizeInitialPaymentMode("first_month")).toBe("one_month");
    expect(initialPaymentConfigFromRow({})).toEqual({ mode: "one_month", customUsd: null });
  });

  it("lee el monto numeric de Postgres (string) y descarta valores no positivos", () => {
    expect(
      initialPaymentConfigFromRow({ reservation_initial_payment_mode: "custom_usd", reservation_initial_payment_usd: "450.00" }),
    ).toEqual({ mode: "custom_usd", customUsd: 450 });
    expect(
      initialPaymentConfigFromRow({ reservation_initial_payment_mode: "custom_usd", reservation_initial_payment_usd: 0 }).customUsd,
    ).toBeNull();
  });
});

describe("resolveInitialPaymentUsd", () => {
  it("modo primer mes = tarifa mensual del tipo elegido", () => {
    expect(resolveInitialPaymentUsd({ mode: "one_month", customUsd: null }, 320)).toBe(320);
    // Un monto residual no cuenta en modo primer mes.
    expect(resolveInitialPaymentUsd({ mode: "one_month", customUsd: 999 }, 320)).toBe(320);
  });

  it("modo monto fijo = el monto, igual para todos los tipos", () => {
    const cfg = { mode: "custom_usd" as const, customUsd: 500 };
    expect(resolveInitialPaymentUsd(cfg, 320)).toBe(500);
    expect(resolveInitialPaymentUsd(cfg, 800)).toBe(500);
  });

  it("modo monto fijo sin monto válido cae al primer mes (nunca 0)", () => {
    expect(resolveInitialPaymentUsd({ mode: "custom_usd", customUsd: null }, 320)).toBe(320);
  });
});

describe("buildInitialPayment", () => {
  it("DR72 (e): el ARS del snapshot queda redondeado a 500, igual al que se muestra", () => {
    const p = buildInitialPayment({ mode: "one_month", customUsd: null }, 333, 1481);
    expect(p.usd).toBe(333);
    expect(p.arsSnapshot).toBe(493000); // 333 × 1481 = 493173
    expect(p.arsDisplay).toBe(493000);
    expect(p.mode).toBe("one_month");
  });

  it("reporta el modo efectivo", () => {
    expect(buildInitialPayment({ mode: "custom_usd", customUsd: 450 }, 300, 1000).mode).toBe("custom_usd");
    expect(buildInitialPayment({ mode: "custom_usd", customUsd: null }, 300, 1000).mode).toBe("one_month");
  });
});

describe("parseInitialPaymentInput (validación server-side)", () => {
  it("sin modo = primer mes por defecto", () => {
    expect(parseInitialPaymentInput({})).toEqual({ ok: true, value: { mode: "one_month", customUsd: null } });
  });

  it("primer mes descarta cualquier monto enviado", () => {
    expect(parseInitialPaymentInput({ mode: "one_month", usd: 700 })).toEqual({
      ok: true,
      value: { mode: "one_month", customUsd: null },
    });
  });

  it("monto fijo válido (acepta string y redondea a centavos)", () => {
    expect(parseInitialPaymentInput({ mode: "custom_usd", usd: "450.555" })).toEqual({
      ok: true,
      value: { mode: "custom_usd", customUsd: 450.56 },
    });
  });

  it.each([["", "vacío"], [0, "cero"], [-5, "negativo"], ["abc", "no numérico"], [null, "null"]] as [unknown, string][])(
    "monto fijo inválido (%s: %s) devuelve un error accionable",
    (usd, _label) => {
      void _label;
      const r = parseInitialPaymentInput({ mode: "custom_usd", usd });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/monto del pago inicial/i);
    },
  );

  it("valida el valor ya redondeado a centavos: 0,004 se redondea a 0 y se rechaza; 0,005 queda en 0,01", () => {
    expect(parseInitialPaymentInput({ mode: "custom_usd", usd: 0.004 }).ok).toBe(false);
    expect(parseInitialPaymentInput({ mode: "custom_usd", usd: "0.004" }).ok).toBe(false);
    expect(parseInitialPaymentInput({ mode: "custom_usd", usd: 0.01 })).toEqual({
      ok: true,
      value: { mode: "custom_usd", customUsd: 0.01 },
    });
  });

  it("rechaza montos desmesurados y modos desconocidos", () => {
    expect(parseInitialPaymentInput({ mode: "custom_usd", usd: 100001 }).ok).toBe(false);
    expect(parseInitialPaymentInput({ mode: "custom_usd", usd: 100000 }).ok).toBe(true);
    expect(parseInitialPaymentInput({ mode: "half_month" }).ok).toBe(false);
  });
});

describe("estimatedFeeUsd / formatInitialPaymentLine", () => {
  it("fee = 5% de la base", () => {
    expect(estimatedFeeUsd(1850)).toBe(92.5);
  });

  it("arma 'A la residencia ... antes del ... · A EstuRed: fee ...'", () => {
    expect(
      formatInitialPaymentLine({ residenceUsd: 300, deadlineLabel: "25/10/2026", feeUsd: 92.5, formatUsd: fmt }),
    ).toBe("A la residencia: USD 300 antes del 25/10/2026 · A EstuRed: fee USD 92.5");
  });

  it("omite la fecha y el fee cuando todavía no existen", () => {
    expect(formatInitialPaymentLine({ residenceUsd: 300, formatUsd: fmt })).toBe("A la residencia: USD 300");
  });
});

describe("resolveNegotiatedInitialPaymentUsd (snapshot final al negociar)", () => {
  const base = { originalInitialUsd: 300, originalMonthlyUsd: 300, finalMonthlyUsd: 280 };

  it("1) si la propuesta fija un pago inicial explícito, se usa ese", () => {
    expect(resolveNegotiatedInitialPaymentUsd({ ...base, proposedUsd: 200, mode: "one_month" })).toBe(200);
    expect(resolveNegotiatedInitialPaymentUsd({ ...base, proposedUsd: 200, mode: "custom_usd" })).toBe(200);
  });

  it("2) sin pago explícito y en modo primer mes, sigue la tarifa mensual negociada", () => {
    expect(resolveNegotiatedInitialPaymentUsd({ ...base, proposedUsd: null, mode: "one_month" })).toBe(280);
    // Sin cambio de tarifa queda igual.
    expect(
      resolveNegotiatedInitialPaymentUsd({ ...base, finalMonthlyUsd: 300, proposedUsd: null, mode: "one_month" }),
    ).toBe(300);
  });

  it("3) sin pago explícito y con monto fijo, queda el monto del original", () => {
    expect(
      resolveNegotiatedInitialPaymentUsd({ ...base, originalInitialUsd: 450, proposedUsd: null, mode: "custom_usd" }),
    ).toBe(450);
  });

  it("si la residencia cambió de modo después de la solicitud, un original que no era el primer mes no se mueve", () => {
    expect(
      resolveNegotiatedInitialPaymentUsd({ ...base, originalInitialUsd: 450, proposedUsd: null, mode: "one_month" }),
    ).toBe(450);
  });
});

describe("describeInitialPaymentForLog", () => {
  it("deja claro el modo en el log de auditoría", () => {
    expect(describeInitialPaymentForLog({ mode: "one_month", customUsd: null })).toBe("Primer mes");
    expect(describeInitialPaymentForLog({ mode: "custom_usd", customUsd: 450 })).toBe("Monto fijo USD 450");
  });
});
