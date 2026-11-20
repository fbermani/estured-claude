/**
 * Borrador local de formularios largos (configuración de residencia, reglamento). Lógica pura: el almacenamiento se inyecta, así que
 * se prueba sin navegador. Un borrador local NUNCA publica, NUNCA envía a revisión ni toca la base: solo guarda lo escrito en este
 * dispositivo para recuperarlo si la persona sale de la pantalla antes de guardar.
 */

/** Cambiar cuando cambie el formato guardado: los borradores de otra versión se ignoran. */
export const DRAFT_VERSION = 1;
/** Un borrador más viejo que esto se descarta (el texto quedó desactualizado). */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StoredDraft<T> = {
  v: number;
  /** Cuándo se guardó (ms desde epoch). */
  savedAt: number;
  /** Huella del estado del servidor sobre el que se editó (p. ej. `updated_at` o el hash de la versión vigente). */
  stamp: string;
  data: T;
};

/** Clave por usuario y por entidad: dos personas del equipo, o dos residencias, nunca comparten borrador. */
export function draftStorageKey(scope: string, userId: string, entityId: string): string {
  return `estured:draft:v${DRAFT_VERSION}:${scope}:${userId}:${entityId}`;
}

export function serializeDraft<T>(data: T, stamp: string, now: number): string {
  const draft: StoredDraft<T> = { v: DRAFT_VERSION, savedAt: now, stamp, data };
  return JSON.stringify(draft);
}

/**
 * Lee un borrador guardado. Devuelve null si falta, está corrupto, es de otra versión, está vencido o `validate` lo rechaza.
 * `validate` recibe el contenido sin tipar y lo devuelve ya saneado (o null): nunca confiar en lo que haya en el almacenamiento.
 */
export function parseDraft<T>(
  raw: string | null,
  validate: (data: unknown) => T | null,
  now: number = Date.now(),
): StoredDraft<T> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== DRAFT_VERSION) return null;
  if (typeof obj.savedAt !== "number" || !Number.isFinite(obj.savedAt)) return null;
  if (typeof obj.stamp !== "string") return null;
  if (now - obj.savedAt > DRAFT_MAX_AGE_MS) return null;
  const data = validate(obj.data);
  if (data === null) return null;
  return { v: DRAFT_VERSION, savedAt: obj.savedAt, stamp: obj.stamp, data };
}

/** El servidor cambió desde que se escribió el borrador: no se pisa en silencio, se ofrece recuperarlo o descartarlo. */
export function isDraftStale(draft: Pick<StoredDraft<unknown>, "stamp">, currentStamp: string): boolean {
  return draft.stamp !== currentStamp;
}

export function readDraft<T>(
  storage: StorageLike | null,
  key: string,
  validate: (data: unknown) => T | null,
  now: number = Date.now(),
): StoredDraft<T> | null {
  if (!storage) return null;
  try {
    return parseDraft(storage.getItem(key), validate, now);
  } catch {
    return null;
  }
}

/** Devuelve false si el almacenamiento no está disponible (modo privado, cuota llena, bloqueado): la pantalla lo avisa. */
export function writeDraft<T>(storage: StorageLike | null, key: string, data: T, stamp: string, now: number = Date.now()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, serializeDraft(data, stamp, now));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Sin almacenamiento no hay nada que limpiar.
  }
}

/** Almacenamiento del navegador, o null si no se puede usar (SSR, modo privado, política del navegador). */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    const probe = "estured:draft:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Hora corta «14:32» para los indicadores de guardado (zona del navegador). */
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
