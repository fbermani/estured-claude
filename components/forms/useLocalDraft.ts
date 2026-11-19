"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserStorage, clearDraft, isDraftStale, readDraft, writeDraft } from "@/lib/forms/localDraft";

export type LocalDraftState = "idle" | "pending" | "saved" | "unavailable";
export type LocalDraftNotice = { kind: "restored"; savedAt: number } | { kind: "stale"; savedAt: number };

/**
 * Guarda en este dispositivo (localStorage) lo que la persona va escribiendo y lo recupera al volver a la pantalla.
 * Un borrador local NUNCA toca el servidor: no publica, no envía a revisión ni cambia estados.
 *
 * - `value` es la foto serializable del formulario; «hay cambios» = distinta de la foto tomada al montar o tras el último guardado OK.
 * - Escribe con retardo (`debounceMs`) y al instante en `pagehide`, al ocultar la pestaña y al desmontar.
 * - Al montar restaura (si el servidor no cambió: mismo `stamp`) o avisa que hay un borrador viejo para que la persona decida.
 * - Con `enabled=false` (solo lectura) no lee ni escribe nada.
 */
export function useLocalDraft<R, V extends R = R>({
  storageKey,
  enabled,
  stamp,
  value,
  validate,
  onRestore,
  debounceMs = 1000,
}: {
  storageKey: string;
  enabled: boolean;
  stamp: string;
  value: V;
  /** Sanea lo leído del almacenamiento; null = descartar el borrador. */
  validate: (raw: unknown) => R | null;
  /** Aplica un borrador (o, al descartar, la foto original) al estado del formulario. */
  onRestore: (data: R) => void;
  debounceMs?: number;
}) {
  const json = JSON.stringify(value);
  const baselineJson = useRef<string | null>(null);
  const baselineValue = useRef<V | null>(null);
  if (baselineJson.current === null) {
    baselineJson.current = json;
    baselineValue.current = value;
  }
  const dirty = enabled && json !== baselineJson.current;

  const [localState, setLocalState] = useState<LocalDraftState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<LocalDraftNotice | null>(null);
  const [staleData, setStaleData] = useState<R | null>(null);

  const latest = useRef({ value, json, stamp, dirty, enabled });
  const wrote = useRef(false);
  const submittedJson = useRef<string | null>(null);
  const onRestoreRef = useRef(onRestore);
  const validateRef = useRef(validate);
  useEffect(() => {
    latest.current = { value, json, stamp, dirty, enabled };
    onRestoreRef.current = onRestore;
    validateRef.current = validate;
  });

  const flush = useCallback(() => {
    const cur = latest.current;
    if (!cur.enabled || !cur.dirty) return;
    const ok = writeDraft(browserStorage(), storageKey, cur.value, cur.stamp);
    wrote.current = ok;
    setLocalState(ok ? "saved" : "unavailable");
    setSavedAt(Date.now());
  }, [storageKey]);

  // Restaurar al montar (lee el almacenamiento una sola vez por clave).
  useEffect(() => {
    if (!enabled) return;
    const draft = readDraft(browserStorage(), storageKey, (raw) => validateRef.current(raw));
    if (!draft) return;
    if (isDraftStale(draft, latest.current.stamp)) {
      setStaleData(draft.data);
      setNotice({ kind: "stale", savedAt: draft.savedAt });
      return;
    }
    onRestoreRef.current(draft.data);
    wrote.current = true;
    setLocalState("saved");
    setSavedAt(draft.savedAt);
    setNotice({ kind: "restored", savedAt: draft.savedAt });
  }, [enabled, storageKey]);

  // Guardar con retardo cada vez que cambia el contenido; si volvió a ser igual al original, limpiar.
  useEffect(() => {
    if (!enabled) return;
    if (!dirty) {
      if (wrote.current) {
        clearDraft(browserStorage(), storageKey);
        wrote.current = false;
        // Estado derivado de un borrador que acaba de limpiarse.
        setLocalState("idle");
        setSavedAt(null);
      }
      return;
    }
    setLocalState((s) => (s === "unavailable" ? s : "pending"));
    const timer = window.setTimeout(flush, debounceMs);
    return () => window.clearTimeout(timer);
  }, [json, dirty, enabled, storageKey, debounceMs, flush]);

  // Volcado inmediato al salir de la página, ocultar la pestaña o desmontar (navegación interna).
  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [enabled, flush]);

  /** Guardar ya (botón «Guardar borrador»). */
  const saveNow = useCallback(() => flush(), [flush]);

  /** Antes de enviar al servidor: recuerda qué contenido se está guardando (lo escrito durante el envío queda como cambio nuevo). */
  const beginSave = useCallback(() => {
    submittedJson.current = latest.current.json;
  }, []);

  /** El servidor confirmó: lo enviado pasa a ser la base y el borrador local ya no hace falta. */
  const completeSave = useCallback(() => {
    if (submittedJson.current !== null) baselineJson.current = submittedJson.current;
    submittedJson.current = null;
    // El flush de desmontaje no debe reescribir el borrador que acaba de quedar obsoleto.
    latest.current.dirty = false;
    clearDraft(browserStorage(), storageKey);
    wrote.current = false;
    setLocalState("idle");
    setSavedAt(null);
    setNotice(null);
  }, [storageKey]);

  /** «Descartar»: borra el borrador y, si ya se había aplicado al formulario, vuelve a lo guardado. */
  const discard = useCallback(() => {
    clearDraft(browserStorage(), storageKey);
    wrote.current = false;
    setLocalState("idle");
    setSavedAt(null);
    setStaleData(null);
    if (notice?.kind === "restored" && baselineValue.current !== null) onRestoreRef.current(baselineValue.current);
    setNotice(null);
  }, [storageKey, notice]);

  /** El borrador era de una versión anterior del servidor y la persona decidió recuperarlo igual. */
  const acceptStale = useCallback(() => {
    if (staleData === null) return;
    onRestoreRef.current(staleData);
    wrote.current = true;
    setStaleData(null);
    setNotice((current) => (current ? { kind: "restored", savedAt: current.savedAt } : null));
  }, [staleData]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { dirty, localState, savedAt, notice, saveNow, beginSave, completeSave, discard, acceptStale, dismissNotice };
}
