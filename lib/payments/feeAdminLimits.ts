/**
 * Límites y validaciones PURAS de las acciones del admin sobre el fee de EstuRed (DR64 (d) y (e); `docs/07` §17.9). Sin `server-only`:
 * las usan la capa de negocio (`feeAdminActions.ts`), las pantallas de `/admin/payments` y los tests.
 */

export const DISPUTE_REASON_MIN = 10;
export const DISPUTE_REASON_MAX = 500;
export const RESOLVE_REASON_MIN = 5;
export const RESOLVE_REASON_MAX = 500;

/** Motivo de «No recibí el pago»: de 10 a 500 caracteres, ya sin espacios sobrantes. Pura. */
export function validateDisputeReason(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length < DISPUTE_REASON_MIN) return { ok: false, error: `Explicá qué pasó en al menos ${DISPUTE_REASON_MIN} caracteres para que quede registrado.` };
  if (value.length > DISPUTE_REASON_MAX) return { ok: false, error: `El motivo es demasiado largo (máximo ${DISPUTE_REASON_MAX} caracteres).` };
  return { ok: true, value };
}

/** Motivo de la respuesta al aviso del pagador: de 5 a 500 caracteres. Pura. */
export function validateResolveReason(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length < RESOLVE_REASON_MIN) return { ok: false, error: "Escribí un motivo para que quede registrado." };
  if (value.length > RESOLVE_REASON_MAX) return { ok: false, error: `El motivo es demasiado largo (máximo ${RESOLVE_REASON_MAX} caracteres).` };
  return { ok: true, value };
}
