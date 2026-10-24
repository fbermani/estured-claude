import { describe, expect, it } from "vitest";
import {
  formatBillingTaxId,
  normalizeBillingTaxId,
  normalizeRelationship,
  parseFamilyProfileInput,
  relationshipLabel,
} from "@/lib/family/familyProfile";

function form(values: Record<string, string>) {
  return { get: (key: string) => values[key] ?? null };
}

const BASE = { first_name: "Martín", last_name: "Fernández", phone: "+54 11 5555-1234", relationship_type: "padre" };

describe("normalizeBillingTaxId", () => {
  it("acepta CUIT válido con guiones y DNI de 7 u 8 dígitos", () => {
    expect(normalizeBillingTaxId("20-12345678-6")).toBe("20123456786");
    expect(normalizeBillingTaxId("12.345.678")).toBe("12345678");
    expect(normalizeBillingTaxId("1234567")).toBe("1234567");
  });
  it("rechaza CUIT con verificador inválido y largos raros", () => {
    expect(normalizeBillingTaxId("20-12345678-5")).toBeNull();
    expect(normalizeBillingTaxId("123456")).toBeNull();
    expect(normalizeBillingTaxId("123456789")).toBeNull();
    expect(normalizeBillingTaxId("abc")).toBeNull();
  });
  it("formatea el CUIT con guiones", () => {
    expect(formatBillingTaxId("20123456786")).toBe("20-12345678-6");
    expect(formatBillingTaxId("12345678")).toBe("12345678");
    expect(formatBillingTaxId(null)).toBe("");
  });
});

describe("relación con el estudiante", () => {
  it("el valor histórico `familiar` equivale a `otro`", () => {
    expect(normalizeRelationship("familiar")).toBe("otro");
    expect(normalizeRelationship("madre")).toBe("madre");
    expect(relationshipLabel("familiar")).toBe("Otro familiar");
  });
});

describe("parseFamilyProfileInput", () => {
  it("acepta el perfil sin datos de facturación", () => {
    const r = parseFamilyProfileInput(form(BASE));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.billingTaxId).toBeNull();
  });
  it("acepta perfil completo y normaliza el CUIT", () => {
    const r = parseFamilyProfileInput(form({ ...BASE, billing_tax_id: "20-12345678-6", billing_vat_condition: "monotributista" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toMatchObject({ billingTaxId: "20123456786", billingVatCondition: "monotributista" });
  });
  it("pide condición de IVA si hay CUIT/DNI", () => {
    const r = parseFamilyProfileInput(form({ ...BASE, billing_tax_id: "12345678" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.billingVatCondition).toBeTruthy();
  });
  it("rechaza nombre vacío, teléfono inválido, relación y CUIT inválidos", () => {
    const r = parseFamilyProfileInput(
      form({ first_name: " ", last_name: "X", phone: "hola", relationship_type: "amigo", billing_tax_id: "20-12345678-5", billing_vat_condition: "x" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["billingTaxId", "billingVatCondition", "firstName", "phone", "relationshipType"]);
    }
  });
});
