import { describe, expect, it } from "vitest";
import {
  isValidAlias,
  isValidCbu,
  isValidCuit,
  maskTail,
  parsePaymentSettingsInput,
} from "@/lib/payments/paymentSettingsValidation";

// CBU de ejemplo con dígitos verificadores correctos (entidad 028, sucursal 0001...). Se calcula acá para no depender de un dato real.
function buildCbu(block1Seven: string, account13: string): string {
  const w1 = [7, 1, 3, 9, 7, 1, 3];
  const w2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3];
  const d = (digits: string, w: number[]) => (10 - (w.reduce((a, x, i) => a + x * Number(digits[i]), 0) % 10)) % 10;
  return `${block1Seven}${d(block1Seven, w1)}${account13}${d(account13, w2)}`;
}

const VALID_CBU = buildCbu("0170099", "2000000123456");

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const BASE = {
  account_holder: "EstuRed S.A.",
  alias: "estured.cobro",
  cbu: VALID_CBU,
  bank_name: "Banco Demo",
};

describe("isValidCbu", () => {
  it("acepta un CBU con ambos dígitos verificadores correctos", () => {
    expect(VALID_CBU).toHaveLength(22);
    expect(isValidCbu(VALID_CBU)).toBe(true);
    expect(isValidCbu("0".repeat(22))).toBe(true);
  });
  it("rechaza un dígito alterado en cualquiera de los dos bloques", () => {
    const flip = (i: number) => VALID_CBU.slice(0, i) + String((Number(VALID_CBU[i]) + 1) % 10) + VALID_CBU.slice(i + 1);
    expect(isValidCbu(flip(2))).toBe(false);
    expect(isValidCbu(flip(15))).toBe(false);
  });
  it("rechaza largo incorrecto o caracteres no numéricos", () => {
    expect(isValidCbu(VALID_CBU.slice(1))).toBe(false);
    expect(isValidCbu(`${VALID_CBU}0`)).toBe(false);
    expect(isValidCbu(`${VALID_CBU.slice(0, 21)}x`)).toBe(false);
  });
});

describe("isValidAlias", () => {
  it("acepta 6 a 20 caracteres con letras, números, puntos y guiones", () => {
    expect(isValidAlias("estured.demo.cobro")).toBe(true);
    expect(isValidAlias("mi-alias.2026")).toBe(true);
  });
  it("rechaza cortos, largos, con espacios o caracteres raros", () => {
    expect(isValidAlias("corto")).toBe(false);
    expect(isValidAlias("a".repeat(21))).toBe(false);
    expect(isValidAlias("con espacio")).toBe(false);
    expect(isValidAlias("ñandú.cobro")).toBe(false);
  });
});

describe("isValidCuit", () => {
  it("acepta CUITs con dígito verificador correcto", () => {
    expect(isValidCuit("20123456786")).toBe(true);
    expect(isValidCuit("30500010912")).toBe(true);
  });
  it("rechaza dígito verificador o largo incorrectos", () => {
    expect(isValidCuit("20123456787")).toBe(false);
    expect(isValidCuit("2012345678")).toBe(false);
  });
});

describe("parsePaymentSettingsInput", () => {
  it("normaliza espacios/guiones del CBU y CUIT y deja opcionales en null", () => {
    const result = parsePaymentSettingsInput(
      form({ ...BASE, cbu: `${VALID_CBU.slice(0, 8)} ${VALID_CBU.slice(8)}`, holder_cuit: "20-12345678-6", instructions: "" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.cbu).toBe(VALID_CBU);
      expect(result.values.holderCuit).toBe("20123456786");
      expect(result.values.instructions).toBeNull();
    }
  });
  it("devuelve un error por campo inválido, en español", () => {
    const result = parsePaymentSettingsInput(form({ account_holder: "", alias: "x", cbu: "123", bank_name: "", holder_cuit: "1" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["accountHolder", "alias", "bankName", "cbu", "holderCuit"]);
      expect(result.errors.cbu).toMatch(/22 dígitos/);
    }
  });
  it("rechaza un CBU de 22 dígitos con verificador inválido", () => {
    const bad = VALID_CBU.slice(0, 21) + String((Number(VALID_CBU[21]) + 1) % 10);
    const result = parsePaymentSettingsInput(form({ ...BASE, cbu: bad }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.cbu).toMatch(/no es válido/);
  });
  it("limita las indicaciones a 500 caracteres", () => {
    const result = parsePaymentSettingsInput(form({ ...BASE, instructions: "x".repeat(501) }));
    expect(result.ok).toBe(false);
  });
});

describe("maskTail", () => {
  it("deja solo los últimos 4 y tolera vacíos", () => {
    expect(maskTail("0123456789012345678901")).toBe("•••• 8901");
    expect(maskTail(null)).toBe("—");
  });
});
