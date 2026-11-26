/**
 * Validación pura de la preapertura (DR43). Sin base ni `server-only`: la comparten las server actions (que son la validación
 * que cuenta, `docs/11` §5.2) y los tests. El formulario del cliente solo ayuda; nunca decide.
 */
import { ageByBirthDate } from "@/lib/students/isMinorByBirthDate";
import {
  ARGENTINA,
  CAREER_OPTIONS,
  COUNTRY_OPTIONS,
  HABIT_OPTIONS,
  INTEREST_OPTIONS,
  MAX_CHIPS,
  OTHER_CAREER,
  PROVINCE_OPTIONS,
  ROOM_TYPE_OPTIONS,
  type RoomType,
} from "@/lib/preapertura/options";

/** Edad mínima de cuenta propia (DR43.2, decisión del dueño 2026-11-08). */
export const ADULT_AGE = 18;
/** Edad mínima absoluta de un menor invitado: la misma regla de siempre del registro (`registerStudent`). */
export const MIN_INVITED_AGE = 14;
export const MAX_AGE = 90;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/** `YYYY-MM-DD` estricto y de calendario real (31/2 no existe). Devuelve null si no es una fecha válida. */
export function parseIsoDate(raw: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1900) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return raw;
}

export type BirthCheck =
  | { kind: "ok"; birthDate: string; age: number; isMinor: boolean }
  /** Menor de 18 sin invitación: no se crea la cuenta; se lo deriva a su familia (DR43.2). */
  | { kind: "minor_blocked"; age: number }
  | { kind: "invalid"; message: string };

const BIRTH_INVALID = "Revisá la fecha de nacimiento.";

/**
 * Edad desde la fecha de nacimiento con el calendario de Buenos Aires (`ageByBirthDate`, la misma regla del resto de la app).
 * Con invitación de un familiar un menor entra salteando el bloqueo, pero solo desde `MIN_INVITED_AGE`.
 */
export function checkBirthDate(raw: unknown, options: { invited: boolean; now?: Date }): BirthCheck {
  const iso = parseIsoDate(String(raw ?? "").trim());
  if (!iso) return { kind: "invalid", message: BIRTH_INVALID };
  const age = ageByBirthDate(iso, options.now);
  if (age === null || age > MAX_AGE) return { kind: "invalid", message: BIRTH_INVALID };
  if (age >= ADULT_AGE) return { kind: "ok", birthDate: iso, age, isMinor: false };
  if (!options.invited) return { kind: "minor_blocked", age };
  if (age < MIN_INVITED_AGE) return { kind: "invalid", message: BIRTH_INVALID };
  return { kind: "ok", birthDate: iso, age, isMinor: true };
}

/* ------------------------------------------------------------------ */
/* Paso 2: perfil                                                       */
/* ------------------------------------------------------------------ */

export type ProfileValue = {
  firstName: string | null;
  country: string | null;
  province: string | null;
  university: string | null;
  career: string | null;
  entryMonth: number | null;
  entryYear: number | null;
  entryUnsure: boolean;
  roomType: RoomType | null;
  habits: string[];
  interests: string[];
  currentResidence: string | null;
  consentComunidad: boolean;
};

export type ProfileResult =
  | { ok: true; value: ProfileValue }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;
const FREE_TEXT_RE = /^[^\u0000-\u001f\u007f<>]+$/u;

function clean(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

/** Próxima vez que llega ese mes (DR43.3: «se asume la próxima temporada»); en noviembre de 2026, enero a abril es 2027. */
export function nextEntryYear(month: number, now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  return month > now.getUTCMonth() + 1 ? year : year + 1;
}

function pickMany(values: unknown[], allowed: readonly string[], label: string, errors: Record<string, string>, field: string): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const value = String(raw);
    if (!allowed.includes(value)) {
      errors[field] = `Elegí ${label} de la lista.`;
      return [];
    }
    if (!out.includes(value)) out.push(value);
  }
  if (out.length > MAX_CHIPS) {
    errors[field] = `Elegí hasta ${MAX_CHIPS}.`;
    return [];
  }
  return out;
}

export type ProfileRaw = {
  first_name?: unknown;
  country?: unknown;
  province?: unknown;
  university?: unknown;
  career?: unknown;
  career_other?: unknown;
  entry?: unknown;
  room_type?: unknown;
  habits?: unknown[];
  interests?: unknown[];
  in_residence?: unknown;
  current_residence?: unknown;
  community?: unknown;
};

/**
 * Valida el perfil. Nombre, país, universidad, carrera, mes de ingreso (o «todavía no sé») y habitación son obligatorios (DR67);
 * hábitos, intereses y comunidad, opcionales. Lo que llega tiene que ser de las listas cerradas o respetar longitudes. `isMinor` viene SIEMPRE de la fecha de nacimiento guardada, nunca del formulario: un menor invitado no puede tildar
 * la comunidad (se ignora en silencio: el casillero ya viene deshabilitado).
 */
export function validateProfile(raw: ProfileRaw, context: { isMinor: boolean; now?: Date }): ProfileResult {
  const errors: Record<string, string> = {};

  const nameText = clean(raw.first_name);
  let firstName: string | null = null;
  if (nameText) {
    if (nameText.length > 60 || !NAME_RE.test(nameText)) errors.first_name = "Revisá tu nombre: usá solo letras (hasta 60).";
    else firstName = nameText;
  } else errors.first_name = "Completá tu nombre.";

  const countryText = clean(raw.country);
  let country: string | null = null;
  if (countryText) {
    if (!COUNTRY_OPTIONS.some((c) => c.name === countryText)) errors.country = "Elegí un país de la lista.";
    else country = countryText;
  } else errors.country = "Elegí tu país.";

  const provinceText = clean(raw.province);
  let province: string | null = null;
  if (country === ARGENTINA && provinceText) {
    if (!(PROVINCE_OPTIONS as readonly string[]).includes(provinceText)) errors.province = "Elegí una provincia de la lista.";
    else province = provinceText;
  }

  const universityText = clean(raw.university);
  let university: string | null = null;
  if (universityText) {
    if (universityText.length < 2 || universityText.length > 120 || !FREE_TEXT_RE.test(universityText)) {
      errors.university = "Revisá la universidad: entre 2 y 120 caracteres.";
    } else university = universityText;
  } else errors.university = "Escribí tu universidad.";

  const careerChoice = clean(raw.career);
  let career: string | null = null;
  if (careerChoice === OTHER_CAREER) {
    const other = clean(raw.career_other);
    if (other.length < 2 || other.length > 120 || !FREE_TEXT_RE.test(other)) errors.career_other = "Escribí tu carrera (entre 2 y 120 caracteres).";
    else career = other;
  } else if (careerChoice) {
    if (!(CAREER_OPTIONS as readonly string[]).includes(careerChoice)) errors.career = "Elegí una carrera de la lista.";
    else career = careerChoice;
  } else errors.career = "Elegí tu carrera.";

  let entryMonth: number | null = null;
  let entryYear: number | null = null;
  let entryUnsure = false;
  const entry = clean(raw.entry);
  if (entry === "unsure") entryUnsure = true;
  else if (entry) {
    if (!["1", "2", "3", "4"].includes(entry)) errors.entry = "Elegí un mes de la lista.";
    else {
      entryMonth = Number(entry);
      entryYear = nextEntryYear(entryMonth, context.now);
    }
  } else errors.entry = "Elegí el mes de ingreso.";

  const roomText = clean(raw.room_type);
  let roomType: RoomType | null = null;
  if (roomText) {
    const found = ROOM_TYPE_OPTIONS.find((r) => r.value === roomText);
    if (!found) errors.room_type = "Elegí un tipo de habitación de la lista.";
    else roomType = found.value;
  } else errors.room_type = "Elegí el tipo de habitación.";

  const habits = pickMany(raw.habits ?? [], HABIT_OPTIONS, "tus hábitos", errors, "habits");
  const interests = pickMany(raw.interests ?? [], INTEREST_OPTIONS, "tus intereses", errors, "interests");

  let currentResidence: string | null = null;
  if (clean(raw.in_residence) === "si") {
    const residence = clean(raw.current_residence);
    if (residence.length < 2 || residence.length > 120 || !FREE_TEXT_RE.test(residence)) {
      errors.current_residence = "Escribí el nombre de tu residencia (entre 2 y 120 caracteres).";
    } else currentResidence = residence;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Revisá los campos marcados.", fieldErrors: errors };
  }

  return {
    ok: true,
    value: {
      firstName,
      country,
      province,
      university,
      career,
      entryMonth,
      entryYear,
      entryUnsure,
      roomType,
      habits,
      interests,
      currentResidence,
      consentComunidad: !context.isMinor && (raw.community === "on" || raw.community === true),
    },
  };
}

/**
 * Medidor del paso 2 (mockup v4): arranca en 10 % por tener la cuenta y suma 90 % repartido en 8 partes (nombre, país,
 * universidad, carrera, mes, tipo de habitación, 2 hábitos, 2 intereses). Provincia y residencia actual no cuentan.
 */
export function profileProgress(parts: {
  name: boolean;
  country: boolean;
  university: boolean;
  career: boolean;
  entry: boolean;
  roomType: boolean;
  habits: boolean;
  interests: boolean;
}): number {
  const done = Object.values(parts).filter(Boolean).length;
  return Math.round(10 + (90 * done) / Object.keys(parts).length);
}
