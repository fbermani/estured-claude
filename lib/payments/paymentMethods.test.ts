import { describe, expect, it } from "vitest";
import {
  PAYMENT_DETAILS_MAX,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  isPaymentMethodKey,
  maskPaymentDetails,
  normalizePaymentMethodKeys,
  paymentMethodInfo,
  paymentMethodLabel,
  validatePaymentDetails,
  validatePaymentLabel,
} from "./paymentMethods";

describe("catálogo de medios de pago", () => {
  it("tiene las 12 claves oficiales de DR63 (a), en ese orden", () => {
    expect([...PAYMENT_METHOD_KEYS]).toEqual([
      "cash",
      "mercadopago",
      "transfer_ars",
      "transfer_usd",
      "belo",
      "prex",
      "uala",
      "brubank",
      "paypal",
      "airtm",
      "western_union",
      "other",
    ]);
    expect(PAYMENT_METHODS.map((m) => m.key)).toEqual([...PAYMENT_METHOD_KEYS]);
  });

  it("solo «Otro» exige nombre libre; todos traen etiqueta y ayuda", () => {
    expect(PAYMENT_METHODS.filter((m) => m.requiresLabel).map((m) => m.key)).toEqual(["other"]);
    expect(PAYMENT_METHODS.every((m) => m.label.length > 0 && m.detailsHint.length > 0)).toBe(true);
  });

  it("isPaymentMethodKey y paymentMethodInfo solo aceptan claves del catálogo", () => {
    expect(isPaymentMethodKey("uala")).toBe(true);
    expect(isPaymentMethodKey("bitcoin")).toBe(false);
    expect(isPaymentMethodKey(null)).toBe(false);
    expect(paymentMethodInfo("uala")?.label).toBe("Ualá");
    expect(paymentMethodInfo("bitcoin")).toBeNull();
  });

  it("paymentMethodLabel usa el nombre libre solo en «Otro»", () => {
    expect(paymentMethodLabel("mercadopago")).toBe("MercadoPago");
    expect(paymentMethodLabel("mercadopago", "Falso")).toBe("MercadoPago");
    expect(paymentMethodLabel("other", "  Cuenta DNI ")).toBe("Cuenta DNI");
    expect(paymentMethodLabel("other")).toBe("Otro");
    expect(paymentMethodLabel("desconocida")).toBe("Otro");
  });
});

describe("normalizePaymentMethodKeys", () => {
  it("ordena según el catálogo", () => {
    expect(normalizePaymentMethodKeys(["other", "cash", "belo"])).toEqual({ ok: true, value: ["cash", "belo", "other"] });
  });
  it("acepta la lista vacía", () => {
    expect(normalizePaymentMethodKeys([])).toEqual({ ok: true, value: [] });
  });
  it("rechaza lo que no es una lista, una clave desconocida y los repetidos", () => {
    expect(normalizePaymentMethodKeys("cash").ok).toBe(false);
    expect(normalizePaymentMethodKeys(["cash", "bitcoin"]).ok).toBe(false);
    expect(normalizePaymentMethodKeys(["cash", "cash"]).ok).toBe(false);
    expect(normalizePaymentMethodKeys([1]).ok).toBe(false);
  });
  it("rechaza más de 30 elementos", () => {
    expect(normalizePaymentMethodKeys(Array.from({ length: 31 }, () => "cash")).ok).toBe(false);
  });
});

describe("validatePaymentDetails", () => {
  it("recorta y acepta de 1 a 500 caracteres", () => {
    expect(validatePaymentDetails("  alias.casa  ")).toEqual({ ok: true, value: "alias.casa" });
    expect(validatePaymentDetails("x".repeat(PAYMENT_DETAILS_MAX)).ok).toBe(true);
    expect(validatePaymentDetails("x".repeat(PAYMENT_DETAILS_MAX + 1)).ok).toBe(false);
  });
  it("rechaza vacío, solo espacios y no-texto", () => {
    expect(validatePaymentDetails("").ok).toBe(false);
    expect(validatePaymentDetails("   \n ").ok).toBe(false);
    expect(validatePaymentDetails(undefined).ok).toBe(false);
    expect(validatePaymentDetails(12345).ok).toBe(false);
  });
  it("admite saltos de línea y rechaza caracteres de control", () => {
    expect(validatePaymentDetails("CBU 0000\nAlias: casa").ok).toBe(true);
    expect(validatePaymentDetails("alias\u0000casa").ok).toBe(false);
  });
  it("el error nombra el medio", () => {
    const r = validatePaymentDetails("", "Belo");
    expect(r.ok === false && r.error).toContain("Belo");
  });
});

describe("validatePaymentLabel", () => {
  it("acepta de 2 a 60 caracteres, recortado", () => {
    expect(validatePaymentLabel("  Cuenta DNI ")).toEqual({ ok: true, value: "Cuenta DNI" });
    expect(validatePaymentLabel("ab").ok).toBe(true);
    expect(validatePaymentLabel("x".repeat(60)).ok).toBe(true);
  });
  it("rechaza 1 carácter, más de 60, saltos de línea y no-texto", () => {
    expect(validatePaymentLabel("a").ok).toBe(false);
    expect(validatePaymentLabel("x".repeat(61)).ok).toBe(false);
    expect(validatePaymentLabel("Cuenta\nDNI").ok).toBe(false);
    expect(validatePaymentLabel(null).ok).toBe(false);
  });
});

describe("maskPaymentDetails", () => {
  it("muestra solo los últimos 4 caracteres", () => {
    expect(maskPaymentDetails("CBU 0170099220000067797370")).toBe("•••• 7370");
    expect(maskPaymentDetails("abc")).toBe("••••");
    expect(maskPaymentDetails("")).toBe("—");
    expect(maskPaymentDetails(null)).toBe("—");
  });
  it("no filtra el resto del contenido", () => {
    expect(maskPaymentDetails("alias casa.norte\nBanco Ejemplo")).not.toContain("casa");
  });
});
