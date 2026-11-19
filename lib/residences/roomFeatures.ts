import { ROOM_FEATURE_OPTIONS } from "@/lib/residences/options";

/**
 * Características de un tipo de habitación: las de la lista (`ROOM_FEATURE_OPTIONS`) más, opcionalmente, UNA propia en «Otro»
 * (hasta 2 palabras). Se guarda en `room_types.features` (jsonb) junto con las de la lista: cualquier valor que no esté en la lista es
 * la característica propia. Lógica pura: la usan el formulario (validación en vivo) y la acción de guardado del perfil (la que vale).
 */
export const ROOM_FEATURE_OTHER_MAX_WORDS = 2;
/** Tope de caracteres de «Otro» (la base no tiene CHECK sobre `features`: este tope lo pone la acción de guardado). */
export const ROOM_FEATURE_OTHER_MAX_CHARS = 24;
/** Tope de características por tipo (las de la lista + «Otro»). */
export const ROOM_FEATURES_MAX = ROOM_FEATURE_OPTIONS.length + 1;

const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} '’-]*$/u;
const PREDEFINED: readonly string[] = ROOM_FEATURE_OPTIONS;

/** Texto sin tildes ni mayúsculas, para comparar «ventana» con «Ventana». */
export function foldFeature(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Recorta, junta espacios repetidos y pone la primera letra en mayúscula (como las de la lista). */
export function normalizeCustomRoomFeature(raw: unknown): string {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  return text ? text.charAt(0).toLocaleUpperCase("es") + text.slice(1) : "";
}

export type CustomFeatureCheck = { ok: true; value: string } | { ok: false; error: string };

/** Valida la característica de «Otro»: hasta 2 palabras y 24 caracteres, solo letras y números, sin repetir una de la lista. */
export function validateCustomRoomFeature(raw: unknown): CustomFeatureCheck {
  const value = normalizeCustomRoomFeature(raw);
  if (!value) return { ok: false, error: "Escribí la característica." };
  if (value.length > ROOM_FEATURE_OTHER_MAX_CHARS) return { ok: false, error: `Hasta ${ROOM_FEATURE_OTHER_MAX_CHARS} caracteres.` };
  if (value.split(" ").length > ROOM_FEATURE_OTHER_MAX_WORDS) return { ok: false, error: `Hasta ${ROOM_FEATURE_OTHER_MAX_WORDS} palabras.` };
  if (!ALLOWED.test(value)) return { ok: false, error: "Usá solo letras y números, sin símbolos ni enlaces." };
  if (/\d{5,}/.test(value)) return { ok: false, error: "No pongas teléfonos ni números largos." };
  if (PREDEFINED.some((f) => foldFeature(f) === foldFeature(value))) return { ok: false, error: "Ya está en la lista: tildala arriba." };
  return { ok: true, value };
}

/** Separa las características de la lista de la propia (la primera que no es de la lista; `null` si no hay). */
export function splitRoomFeatures(features: readonly string[]): { listed: string[]; custom: string | null } {
  const listed = features.filter((f) => PREDEFINED.includes(f));
  const custom = features.find((f) => !PREDEFINED.includes(f)) ?? null;
  return { listed, custom };
}

/** Arma el valor guardado: las de la lista y, si hay y es válida, la propia (lo que ya está vacío se omite). */
export function joinRoomFeatures(listed: readonly string[], custom: string | null): string[] {
  const text = custom === null ? "" : normalizeCustomRoomFeature(custom);
  return text ? [...listed, text] : [...listed];
}

export type RoomFeaturesCheck = { ok: true; features: string[] } | { ok: false; error: string };

/**
 * Validación del servidor de las características de un tipo: las de la lista pasan (sin repetir); lo demás es «Otro» y se permite una
 * sola, normalizada y válida. Devuelve la lista final a guardar (el texto de «Otro» ya normalizado).
 */
export function sanitizeRoomFeatures(raw: readonly unknown[]): RoomFeaturesCheck {
  const strings = raw.map((f) => (typeof f === "string" ? f : ""));
  const listed = [...new Set(strings.filter((f) => PREDEFINED.includes(f)))];
  const others = strings.filter((f) => !PREDEFINED.includes(f));
  if (others.length > 1) return { ok: false, error: "Solo podés escribir una característica en «Otro»." };
  if (others.length === 0) return { ok: true, features: listed };
  const checked = validateCustomRoomFeature(others[0]);
  if (!checked.ok) return { ok: false, error: checked.error };
  return { ok: true, features: [...listed, checked.value] };
}
