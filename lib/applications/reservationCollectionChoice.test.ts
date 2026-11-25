import { describe, expect, it } from "vitest";
import {
  availableCollectionPaths,
  buildCollectionChoiceContext,
  buildInstructionsSnapshot,
  collectionEnabledNotice,
  resolveCollectionChoice,
  resolveExpectedAmounts,
} from "@/lib/applications/reservationCollectionChoice";

const APPROVED = [
  { methodKey: "transfer_ars", methodLabel: null },
  { methodKey: "mercadopago", methodLabel: null },
];
const ctx = (over: Partial<Parameters<typeof buildCollectionChoiceContext>[0]> = {}) =>
  buildCollectionChoiceContext({ modes: ["enabled_methods"], acceptedMethods: ["transfer_ars", "mercadopago"], approved: APPROVED, ...over });

describe("caminos disponibles", () => {
  it("sin configurar es contacto directo", () => {
    expect(availableCollectionPaths(ctx({ modes: null })).paths).toEqual(["whatsapp_direct"]);
  });
  it("medios sin ningún dato aprobado se degrada a contacto directo", () => {
    const res = availableCollectionPaths(ctx({ approved: [] }));
    expect(res).toEqual({ paths: ["whatsapp_direct"], degraded: true });
  });
  it("ambas opciones activas ofrecen los dos caminos", () => {
    expect(availableCollectionPaths(ctx({ modes: ["enabled_methods", "whatsapp_direct"] })).paths).toEqual(["enabled_methods", "whatsapp_direct"]);
  });
  it("un medio aceptado pero con datos solo pendientes no se ofrece", () => {
    expect(ctx({ approved: [{ methodKey: "transfer_ars", methodLabel: null }] }).methods.map((m) => m.key)).toEqual(["transfer_ars"]);
  });
});

describe("preferencia «Otro» (DR66 (g))", () => {
  const alternative = (over: Parameters<typeof ctx>[0] = {}) => ctx({ preferred: "alternative", ...over });

  it("con solo medios suma el contacto directo para esa solicitud", () => {
    expect(availableCollectionPaths(alternative())).toEqual({ paths: ["enabled_methods", "whatsapp_direct"], degraded: false });
  });
  it("con ambas opciones activas no duplica el camino", () => {
    expect(availableCollectionPaths(alternative({ modes: ["enabled_methods", "whatsapp_direct"] })).paths).toEqual(["enabled_methods", "whatsapp_direct"]);
  });
  it("sin datos aprobados sigue degradado a contacto directo", () => {
    expect(availableCollectionPaths(alternative({ approved: [] }))).toEqual({ paths: ["whatsapp_direct"], degraded: true });
  });
  it("sin «Otro» las residencias solo con medios no ofrecen contacto directo", () => {
    expect(availableCollectionPaths(ctx({ preferred: "mercadopago" })).paths).toEqual(["enabled_methods"]);
  });
  it("el servidor acepta el contacto directo y exige elegir el camino", () => {
    expect(resolveCollectionChoice(alternative(), { collectionMode: "whatsapp_direct" })).toEqual({ ok: true, value: { mode: "whatsapp_direct" } });
    expect(resolveCollectionChoice(alternative(), { chosenMethod: "mercadopago" }).ok).toBe(false);
    const methods = resolveCollectionChoice(alternative(), { collectionMode: "enabled_methods", chosenMethod: "mercadopago" });
    expect(methods.ok && methods.value.mode).toBe("enabled_methods");
  });
});

describe("resolveCollectionChoice", () => {
  it("con un solo camino ignora el modo enviado", () => {
    const res = resolveCollectionChoice(ctx(), { collectionMode: "whatsapp_direct", chosenMethod: "mercadopago" });
    expect(res).toEqual({ ok: true, value: { mode: "enabled_methods", methodKey: "mercadopago", methodLabel: "MercadoPago" } });
  });
  it("con dos caminos exige elegir", () => {
    const both = ctx({ modes: ["enabled_methods", "whatsapp_direct"] });
    expect(resolveCollectionChoice(both, {}).ok).toBe(false);
    expect(resolveCollectionChoice(both, { collectionMode: "otra" }).ok).toBe(false);
    expect(resolveCollectionChoice(both, { collectionMode: "whatsapp_direct" })).toEqual({ ok: true, value: { mode: "whatsapp_direct" } });
  });
  it("precarga la preferencia del estudiante", () => {
    const res = resolveCollectionChoice(ctx({ preferred: "mercadopago" }), {});
    expect(res.ok && res.value.mode === "enabled_methods" && res.value.methodKey).toBe("mercadopago");
  });
  it("usa el único medio disponible; con varios y sin preferencia pide elegir", () => {
    expect(resolveCollectionChoice(ctx({ approved: [APPROVED[0]] }), {}).ok).toBe(true);
    expect(resolveCollectionChoice(ctx(), {}).ok).toBe(false);
  });
  it("rechaza un medio no aprobado, no aceptado, inexistente o de tipo inválido", () => {
    const c = ctx({ acceptedMethods: ["transfer_ars", "uala"], approved: [APPROVED[0]] });
    for (const chosenMethod of ["uala", "mercadopago", "inventado", 7]) {
      expect(resolveCollectionChoice(c, { chosenMethod }).ok).toBe(false);
    }
  });
  it("una preferencia que ya no se ofrece no se precarga", () => {
    expect(ctx({ preferred: "belo" }).preferredMethod).toBeNull();
  });
});

describe("buildInstructionsSnapshot", () => {
  it("arma etiqueta + datos aprobados", () => {
    expect(buildInstructionsSnapshot("transfer_ars", { methodLabel: null, details: " CBU 123\nalias casa " })).toEqual({
      ok: true,
      value: "Transferencia en pesos\nCBU 123\nalias casa",
    });
  });
  it("usa el nombre aprobado de «Otro»", () => {
    const res = buildInstructionsSnapshot("other", { methodLabel: "Cuenta DNI", details: "usuario x" });
    expect(res.ok && res.value.startsWith("Cuenta DNI\n")).toBe(true);
  });
  it("falla sin datos o por largo", () => {
    expect(buildInstructionsSnapshot("cash", { methodLabel: null, details: "  " }).ok).toBe(false);
    expect(buildInstructionsSnapshot("cash", { methodLabel: null, details: "x".repeat(2000) }).ok).toBe(false);
  });
});

describe("resolveExpectedAmounts", () => {
  it("toma el pago inicial del snapshot y su ARS", () => {
    expect(resolveExpectedAmounts({ reservation_payment_amount_usd: "300", reservation_payment_amount_ars: "450000", monthly_price_usd: 300 })).toEqual({
      ok: true,
      value: { usd: 300, ars: 450000 },
    });
  });
  it("sin pago inicial usa la tarifa; sin ARS usa el tipo de cambio del snapshot", () => {
    expect(resolveExpectedAmounts({ monthly_price_usd: 250, exchange_rate_ars_per_usd: 1500 })).toEqual({ ok: true, value: { usd: 250, ars: 375000 } });
  });
  it("rechaza monto cero, ausente o sin tipo de cambio", () => {
    expect(resolveExpectedAmounts({ reservation_payment_amount_usd: 0, monthly_price_usd: 0 }).ok).toBe(false);
    expect(resolveExpectedAmounts({}).ok).toBe(false);
    expect(resolveExpectedAmounts({ monthly_price_usd: 100 }).ok).toBe(false);
  });
});

describe("collectionEnabledNotice", () => {
  const base = { residenceName: "Norte", methodLabel: "MercadoPago", studentName: "Lucía F." };
  it("nunca lleva datos de cobro ni promete disponibilidad", () => {
    for (const mode of ["enabled_methods", "whatsapp_direct"] as const) {
      for (const audience of ["student", "family"] as const) {
        for (const isMinor of [false, true]) {
          const n = collectionEnabledNotice({ ...base, mode, audience, isMinor });
          expect(n.body).toContain("sujeta a confirmación");
          expect(`${n.title} ${n.body}`).not.toMatch(/garantiz|CBU|alias/i);
        }
      }
    }
  });
  it("ningún aviso al estudiante o a la familia nombra WhatsApp (DR66 (b))", () => {
    for (const mode of ["enabled_methods", "whatsapp_direct"] as const) {
      for (const audience of ["student", "family"] as const) {
        for (const isMinor of [false, true]) {
          const n = collectionEnabledNotice({ ...base, mode, audience, isMinor });
          expect(`${n.title} ${n.body}`).not.toMatch(/whatsapp/i);
        }
      }
    }
  });
  it("en contacto directo el menor ve al familiar", () => {
    expect(collectionEnabledNotice({ ...base, mode: "whatsapp_direct", audience: "student", isMinor: true }).body).toContain("familiar vinculado");
    expect(collectionEnabledNotice({ ...base, mode: "whatsapp_direct", audience: "student", isMinor: false }).body).toContain("te va a indicar el monto final y cómo pagar");
  });
});
