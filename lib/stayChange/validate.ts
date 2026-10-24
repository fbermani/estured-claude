/**
 * Validación server-side del aviso "Quiero cambiar" y de la respuesta de la residencia (DR3, Ciclo 59).
 * Funciones puras: las usan las acciones y los tests. Mensajes en voseo, accionables, sin jerga.
 */

import { MAX_MOVING_NOTE, type DepositReturnStatus } from "@/lib/stayChange/copy";

export const MAX_STUDENT_MESSAGE = 500;
export const MIN_RESPONSE_MESSAGE = 20;
export const MAX_RESPONSE_FIELD = 1000;
export const MAX_EXIT_COSTS_USD = 100_000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" real (rechaza 2026-02-31). */
export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Hoy en America/Argentina/Buenos_Aires como "YYYY-MM-DD" (el `now` se inyecta para testear). */
export function todayArgentinaIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(now);
}

export type StudentIntentInput = {
  estimatedExitDate: string | null;
  studentMessage: string | null;
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Texto opcional: recorta; vacío → null. */
function optionalText(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  return text ? text : null;
}

/**
 * Campos que el estudiante puede cargar o editar (fecha estimada y mensaje). La fecha no puede ser
 * anterior a hoy; el mensaje, hasta 500 caracteres.
 */
export function validateStudentIntentInput(
  raw: { estimatedExitDate?: unknown; studentMessage?: unknown },
  now: Date = new Date(),
): ValidationResult<StudentIntentInput> {
  const dateText = optionalText(raw.estimatedExitDate);
  if (dateText) {
    if (!isValidDateOnly(dateText)) return { ok: false, error: "La fecha estimada no es válida. Elegí una fecha del calendario." };
    if (dateText < todayArgentinaIso(now)) {
      return { ok: false, error: "La fecha estimada no puede ser anterior a hoy." };
    }
  }
  const message = optionalText(raw.studentMessage);
  if (message && message.length > MAX_STUDENT_MESSAGE) {
    return { ok: false, error: `El mensaje puede tener hasta ${MAX_STUDENT_MESSAGE} caracteres.` };
  }
  return {
    ok: true,
    value: { estimatedExitDate: dateText, studentMessage: message },
  };
}

/** Checkbox de FormData: "on" / "true" / "1". */
export function isChecked(value: FormDataEntryValue | null | undefined): boolean {
  return value === "on" || value === "true" || value === "1";
}

export type ResidenceResponseInput = {
  message: string;
  exitCostsText: string | null;
  exitCostsUsd: number | null;
  exitConditionsText: string | null;
  exitDetailsText: string | null;
};

/**
 * Respuesta de la residencia actual: el mensaje es obligatorio (mínimo 20 caracteres); costos, condiciones y
 * detalles son opcionales (hasta 1000 caracteres cada uno); el monto de referencia en USD es opcional.
 */
export function validateResidenceResponse(raw: {
  message?: unknown;
  exitCostsText?: unknown;
  exitCostsUsd?: unknown;
  exitConditionsText?: unknown;
  exitDetailsText?: unknown;
}): ValidationResult<ResidenceResponseInput> {
  const message = optionalText(raw.message);
  if (!message || message.length < MIN_RESPONSE_MESSAGE) {
    return { ok: false, error: `Escribí un mensaje de al menos ${MIN_RESPONSE_MESSAGE} caracteres para tu residente.` };
  }
  const fields: [string, string | null][] = [
    ["El mensaje", message],
    ["Los costos de salida", optionalText(raw.exitCostsText)],
    ["Las condiciones", optionalText(raw.exitConditionsText)],
    ["Los detalles de la salida", optionalText(raw.exitDetailsText)],
  ];
  for (const [label, text] of fields) {
    if (text && text.length > MAX_RESPONSE_FIELD) {
      return { ok: false, error: `${label} pueden tener hasta ${MAX_RESPONSE_FIELD} caracteres.` };
    }
  }

  let usd: number | null = null;
  const usdRaw = typeof raw.exitCostsUsd === "number" ? String(raw.exitCostsUsd) : optionalText(raw.exitCostsUsd);
  if (usdRaw) {
    const parsed = Number(usdRaw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_EXIT_COSTS_USD) {
      return { ok: false, error: `El monto de referencia tiene que estar entre 0 y ${MAX_EXIT_COSTS_USD.toLocaleString("es-AR")} USD.` };
    }
    usd = Math.round(parsed * 100) / 100;
  }

  return {
    ok: true,
    value: {
      message,
      exitCostsText: fields[1][1],
      exitCostsUsd: usd,
      exitConditionsText: fields[2][1],
      exitDetailsText: fields[3][1],
    },
  };
}

/**
 * Política de salida anticipada y cláusulas básicas del depósito del perfil de la residencia (texto libre,
 * informativo, hasta 1000 caracteres cada uno). "Hay depósito" no es un campo acá: sale de `deposit_usd`.
 */
export function validateEarlyExitPolicy(raw: {
  depositClausesText?: unknown;
  costsText?: unknown;
  conditionsText?: unknown;
}): ValidationResult<{ depositClausesText: string | null; costsText: string | null; conditionsText: string | null }> {
  const depositClausesText = optionalText(raw.depositClausesText);
  const costsText = optionalText(raw.costsText);
  const conditionsText = optionalText(raw.conditionsText);
  if ([depositClausesText, costsText, conditionsText].some((t) => t && t.length > MAX_RESPONSE_FIELD)) {
    return { ok: false, error: `Cada campo de la política de salida puede tener hasta ${MAX_RESPONSE_FIELD} caracteres.` };
  }
  return { ok: true, value: { depositClausesText, costsText, conditionsText } };
}

/** Nota voluntaria del estudiante a la residencia nueva ("desde dónde te mudás y por qué"), hasta 500 caracteres. */
export function validateMovingNote(raw: unknown): ValidationResult<string | null> {
  const note = optionalText(raw);
  if (note && note.length > MAX_MOVING_NOTE) {
    return { ok: false, error: `La nota puede tener hasta ${MAX_MOVING_NOTE} caracteres.` };
  }
  return { ok: true, value: note };
}

export const MAX_EXIT_RESIDENCE_NOTE = 2000;
export const MAX_EXIT_STUDENT_NOTE = 1000;

/**
 * Cierre de la salida anticipada que registra la residencia: fecha real de salida, devolución del depósito (si
 * había: devuelto / no devuelto; si no había: "sin depósito") y nota libre opcional.
 */
export function validateEarlyExitRecord(
  raw: { exitDate?: unknown; depositStatus?: unknown; residenceNote?: unknown },
  /** `null` = no se sabe (estadía cargada a mano, sin reserva): la residencia elige entre las tres opciones. */
  options: { hadDeposit: boolean | null },
  now: Date = new Date(),
): ValidationResult<{ exitDate: string; depositStatus: DepositReturnStatus; residenceNote: string | null }> {
  const exitDate = optionalText(raw.exitDate);
  if (!exitDate || !isValidDateOnly(exitDate)) return { ok: false, error: "Indicá la fecha real de salida." };
  const today = todayArgentinaIso(now);
  const maxDate = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const minDate = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 12);
    return d.toISOString().slice(0, 10);
  })();
  if (exitDate > maxDate) return { ok: false, error: "La fecha de salida no puede ser más de 7 días posterior a hoy." };
  if (exitDate < minDate) return { ok: false, error: "La fecha de salida no puede ser de hace más de 12 meses." };
  let depositStatus: DepositReturnStatus;
  if (options.hadDeposit === null) {
    if (raw.depositStatus !== "returned" && raw.depositStatus !== "not_returned" && raw.depositStatus !== "no_deposit") {
      return { ok: false, error: "Indicá si se devolvió el depósito o si no había depósito." };
    }
    depositStatus = raw.depositStatus;
  } else if (options.hadDeposit) {
    if (raw.depositStatus !== "returned" && raw.depositStatus !== "not_returned") {
      return { ok: false, error: "Indicá si se devolvió o no el depósito." };
    }
    depositStatus = raw.depositStatus;
  } else {
    depositStatus = "no_deposit";
  }
  const residenceNote = optionalText(raw.residenceNote);
  if (residenceNote && residenceNote.length > MAX_EXIT_RESIDENCE_NOTE) {
    return { ok: false, error: `La nota puede tener hasta ${MAX_EXIT_RESIDENCE_NOTE} caracteres.` };
  }
  return { ok: true, value: { exitDate, depositStatus, residenceNote } };
}
