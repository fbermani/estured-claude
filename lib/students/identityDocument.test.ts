import { describe, expect, it } from "vitest";
import { maskIdentityDocumentNumber, normalizeIdentityDocumentNumber, validateIdentityDocument } from "./identityDocument";

describe("identityDocument", () => {
  it("normaliza puntos, espacios y guiones", () => {
    expect(normalizeIdentityDocumentNumber(" 38.123.456 ")).toBe("38123456");
    expect(normalizeIdentityDocumentNumber("ab-12 3c")).toBe("AB123C");
  });
  it("acepta DNI de 7 u 8 dígitos", () => {
    expect(validateIdentityDocument("dni", "38.123.456")).toEqual({ ok: true, type: "dni", number: "38123456" });
    expect(validateIdentityDocument("dni", "9123456").ok).toBe(true);
  });
  it("rechaza DNI con letras o largo incorrecto", () => {
    expect(validateIdentityDocument("dni", "1234567A").ok).toBe(false);
    expect(validateIdentityDocument("dni", "123456").ok).toBe(false);
    expect(validateIdentityDocument("dni", "123456789").ok).toBe(false);
  });
  it("acepta pasaporte alfanumérico y rechaza símbolos o largo fuera de rango", () => {
    expect(validateIdentityDocument("passport", "aa 123456")).toEqual({ ok: true, type: "passport", number: "AA123456" });
    expect(validateIdentityDocument("passport", "1234").ok).toBe(false);
    expect(validateIdentityDocument("other", "AB#1234").ok).toBe(false);
    expect(validateIdentityDocument("other", "A".repeat(21)).ok).toBe(false);
  });
  it("rechaza tipo inválido y número vacío", () => {
    expect(validateIdentityDocument("cedula", "12345678").ok).toBe(false);
    expect(validateIdentityDocument("dni", "  ").ok).toBe(false);
    expect(validateIdentityDocument(undefined, "12345678").ok).toBe(false);
  });
  it("enmascara dejando los últimos 3", () => {
    expect(maskIdentityDocumentNumber("38123456")).toBe("•••••456");
    expect(maskIdentityDocumentNumber("12")).toBe("••");
  });
});
