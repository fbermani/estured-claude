/**
 * Pedido de cambios y reenvío a revisión (Ciclo 66, DR5 en docs/00 §31). Funciones puras, sin acceso a datos.
 */

export const CHANGES_MESSAGE_MIN = 10;
export const CHANGES_MESSAGE_MAX = 1000;

/** Valida el "Mensaje para la residencia" del admin (obligatorio al pedir cambios). */
export function validateChangesMessage(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length < CHANGES_MESSAGE_MIN) {
    return { ok: false, error: `Escribí un mensaje para la residencia de al menos ${CHANGES_MESSAGE_MIN} caracteres: es lo que va a ver para saber qué corregir.` };
  }
  if (value.length > CHANGES_MESSAGE_MAX) {
    return { ok: false, error: `El mensaje para la residencia no puede superar los ${CHANGES_MESSAGE_MAX} caracteres.` };
  }
  return { ok: true, value };
}

/** Estados de residencia desde los que "Enviar para revisión" la manda a `pending_verification`. */
export const SUBMITTABLE_RESIDENCE_STATUSES = ["draft", "needs_changes", "verification_expired"] as const;

/** Reenvío (no primer envío): tras pedir cambios (DR5) o tras vencer la verificación anual (DR7). */
export function isResubmission(residenceStatus: string | null | undefined): boolean {
  return residenceStatus === "needs_changes" || residenceStatus === "verification_expired";
}

/** Estado de `residence_verifications` al enviar: `needs_changes` y `expired` (DR7) vuelven a `documents_pending`; `not_started` también (ya existía). */
export const VERIFICATION_STATUSES_RESET_ON_SUBMIT = ["not_started", "needs_changes", "expired"] as const;

/** `true` si el error de PostgREST/Postgres indica una columna inexistente (migración 0048 sin aplicar). */
export function isMissingColumnError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .* does not exist|could not find the '.*' column/i.test(error.message ?? "");
}

/** Texto del aviso al equipo (sin el mensaje del admin: eso se ve solo en el panel). */
export const CHANGES_REQUESTED_NOTICE = "Entrá a tu panel para ver qué corregir y reenviarlo.";

/** Copy del banner/aviso destacado según haya o no mensaje (mensajes previos a la 0048 son null). */
export function changesRequestedMessageOrFallback(message: string | null | undefined): { text: string; generic: boolean } {
  const trimmed = (message ?? "").trim();
  if (trimmed) return { text: trimmed, generic: false };
  return { text: "Hay información del perfil para corregir antes de poder publicar la residencia.", generic: true };
}
