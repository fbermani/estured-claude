import { isValidCuit } from "@/lib/payments/paymentSettingsValidation";

/**
 * Perfil propio del familiar vinculado (DR4, docs/00 §31; docs/06 §6.3). Funciones puras (sin I/O) para validar en
 * la server action y poder testearlas. Los CHECK de la migración 0045 espejan estas reglas.
 */

export const FAMILY_RELATIONSHIPS = [
  { value: "padre", label: "Padre" },
  { value: "madre", label: "Madre" },
  { value: "tutor", label: "Tutor o tutora" },
  { value: "otro", label: "Otro familiar" },
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number]["value"];

/** Mismos valores que `estured_fee_payments.payer_iva_condition` (docs/08 §6.8). */
export const VAT_CONDITIONS = [
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "monotributista", label: "Monotributista" },
  { value: "exento", label: "Exento" },
] as const;

export type VatCondition = (typeof VAT_CONDITIONS)[number]["value"];

const VAT_VALUES = new Set<string>(VAT_CONDITIONS.map((c) => c.value));
const RELATIONSHIP_VALUES = new Set<string>(FAMILY_RELATIONSHIPS.map((r) => r.value));

/** El valor histórico `familiar` equivale a `otro` (docs/06 §6.3); cualquier valor desconocido también cae en `otro`. */
export function normalizeRelationship(raw: string | null | undefined): FamilyRelationship {
  return raw && RELATIONSHIP_VALUES.has(raw) ? (raw as FamilyRelationship) : "otro";
}

export function relationshipLabel(raw: string | null | undefined): string {
  const value = normalizeRelationship(raw);
  return FAMILY_RELATIONSHIPS.find((r) => r.value === value)!.label;
}

/** Solo dígitos: acepta CUIT con guiones ("20-12345678-6") o espacios. */
export function digitsOnly(raw: string): string {
  return raw.replace(/[\s.-]/g, "");
}

/** CUIT/CUIL (11 dígitos con verificador) o DNI (7 u 8 dígitos). Devuelve los dígitos normalizados o `null` si no es válido. */
export function normalizeBillingTaxId(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (/^\d{7,8}$/.test(digits)) return digits;
  if (/^\d{11}$/.test(digits) && isValidCuit(digits)) return digits;
  return null;
}

/** "20-12345678-6" para CUIT; el DNI se muestra tal cual. */
export function formatBillingTaxId(digits: string | null | undefined): string {
  if (!digits) return "";
  return digits.length === 11 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : digits;
}

export type FamilyProfileInput = {
  firstName: string;
  lastName: string;
  phone: string;
  relationshipType: FamilyRelationship;
  /** `null` si no cargó datos de facturación (son opcionales hasta el día del pago). */
  billingTaxId: string | null;
  billingVatCondition: VatCondition | null;
};

export type FamilyProfileErrors = Partial<Record<keyof FamilyProfileInput, string>>;

export type FamilyProfileParseResult =
  | { ok: true; values: FamilyProfileInput }
  | { ok: false; errors: FamilyProfileErrors };

function text(raw: FormDataEntryValue | null | undefined): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

export function parseFamilyProfileInput(formData: Pick<FormData, "get">): FamilyProfileParseResult {
  const errors: FamilyProfileErrors = {};

  const firstName = text(formData.get("first_name"));
  if (!firstName || firstName.length > 80) errors.firstName = "Contanos tu nombre (hasta 80 caracteres).";
  const lastName = text(formData.get("last_name"));
  if (!lastName || lastName.length > 80) errors.lastName = "Contanos tu apellido (hasta 80 caracteres).";

  const phone = text(formData.get("phone"));
  if (!/^[+0-9()\-\s]{6,25}$/.test(phone)) errors.phone = "Revisá el teléfono: usá números, espacios o «+».";

  const relationshipRaw = text(formData.get("relationship_type"));
  if (!RELATIONSHIP_VALUES.has(relationshipRaw)) errors.relationshipType = "Elegí tu relación con el estudiante.";

  const taxRaw = text(formData.get("billing_tax_id"));
  let billingTaxId: string | null = null;
  if (taxRaw) {
    billingTaxId = normalizeBillingTaxId(taxRaw);
    if (!billingTaxId) errors.billingTaxId = "Revisá el CUIT/DNI: el CUIT lleva 11 dígitos válidos y el DNI 7 u 8.";
  }

  const vatRaw = text(formData.get("billing_vat_condition"));
  let billingVatCondition: VatCondition | null = null;
  if (vatRaw) {
    if (VAT_VALUES.has(vatRaw)) billingVatCondition = vatRaw as VatCondition;
    else errors.billingVatCondition = "Elegí una condición frente al IVA de la lista.";
  }
  // Un CUIT sin condición de IVA no sirve para facturar: se piden juntos.
  if (billingTaxId && !billingVatCondition && !errors.billingVatCondition) {
    errors.billingVatCondition = "Elegí tu condición frente al IVA para completar los datos de facturación.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    values: {
      firstName,
      lastName,
      phone,
      relationshipType: relationshipRaw as FamilyRelationship,
      billingTaxId,
      billingVatCondition,
    },
  };
}
