/**
 * Validación de los datos de cobro del fee (D2 / H02, migración 0038).
 * Funciones puras (sin I/O) para poder testearlas y reusarlas en la server
 * action. Los CHECK de la tabla `payment_settings` espejan estas reglas.
 */

export type PaymentSettingsInput = {
  accountHolder: string;
  alias: string;
  cbu: string;
  bankName: string;
  /** 11 dígitos, sin guiones. `null` si no corresponde. */
  holderCuit: string | null;
  instructions: string | null;
};

export type PaymentSettingsErrors = Partial<Record<keyof PaymentSettingsInput, string>>;

export type PaymentSettingsParseResult =
  | { ok: true; values: PaymentSettingsInput }
  | { ok: false; errors: PaymentSettingsErrors };

const CBU_BLOCK1_WEIGHTS = [7, 1, 3, 9, 7, 1, 3];
const CBU_BLOCK2_WEIGHTS = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3];
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

function weightedDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  return (10 - (sum % 10)) % 10;
}

/** CBU: 22 dígitos; el dígito 8 verifica el bloque de entidad/sucursal y el 22 el de cuenta. */
export function isValidCbu(value: string): boolean {
  if (!/^\d{22}$/.test(value)) return false;
  const block1 = value.slice(0, 8);
  const block2 = value.slice(8);
  return (
    weightedDigit(block1, CBU_BLOCK1_WEIGHTS) === Number(block1[7]) &&
    weightedDigit(block2, CBU_BLOCK2_WEIGHTS) === Number(block2[13])
  );
}

/** Alias bancario: 6 a 20 caracteres, letras, números, puntos y guiones. */
export function isValidAlias(value: string): boolean {
  return /^[A-Za-z0-9.-]{6,20}$/.test(value);
}

/** CUIT/CUIL: 11 dígitos con dígito verificador (módulo 11). */
export function isValidCuit(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const sum = CUIT_WEIGHTS.reduce((acc, w, i) => acc + w * Number(value[i]), 0);
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return expected === Number(value[10]);
}

function text(raw: FormDataEntryValue | null | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** Valida y normaliza lo que llega del formulario (acepta CBU/CUIT con espacios o guiones). */
export function parsePaymentSettingsInput(formData: Pick<FormData, "get">): PaymentSettingsParseResult {
  const errors: PaymentSettingsErrors = {};

  const accountHolder = text(formData.get("account_holder")).replace(/\s+/g, " ");
  if (accountHolder.length < 2 || accountHolder.length > 120) {
    errors.accountHolder = "Ingresá el titular de la cuenta (entre 2 y 120 caracteres).";
  }

  const alias = text(formData.get("alias"));
  if (!isValidAlias(alias)) {
    errors.alias = "El alias debe tener entre 6 y 20 caracteres: letras, números, puntos o guiones, sin espacios.";
  }

  const cbu = text(formData.get("cbu")).replace(/[\s-]/g, "");
  if (!/^\d{22}$/.test(cbu)) {
    errors.cbu = "El CBU tiene 22 dígitos, solo números.";
  } else if (!isValidCbu(cbu)) {
    errors.cbu = "El CBU no es válido: revisá que no falte o sobre ningún dígito.";
  }

  const bankName = text(formData.get("bank_name")).replace(/\s+/g, " ");
  if (bankName.length < 2 || bankName.length > 80) {
    errors.bankName = "Ingresá el banco (entre 2 y 80 caracteres).";
  }

  const cuitRaw = text(formData.get("holder_cuit")).replace(/[\s-]/g, "");
  let holderCuit: string | null = null;
  if (cuitRaw) {
    if (!isValidCuit(cuitRaw)) errors.holderCuit = "El CUIT/CUIL no es válido: son 11 dígitos con su dígito verificador.";
    else holderCuit = cuitRaw;
  }

  const instructionsRaw = text(formData.get("instructions"));
  if (instructionsRaw.length > 500) errors.instructions = "Las indicaciones pueden tener hasta 500 caracteres.";
  const instructions = instructionsRaw || null;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { accountHolder, alias, cbu, bankName, holderCuit, instructions } };
}

/** "•••• 1234": para auditoría y pantallas donde no hace falta el dato completo. */
export function maskTail(value: string | null | undefined, visible = 4): string {
  if (!value) return "—";
  return value.length <= visible ? value : `${"•".repeat(4)} ${value.slice(-visible)}`;
}
