/**
 * Tope de reaperturas y escalado a 7 días del cobro de la reserva y del fee (DR66 (a), `docs/00`). Módulo PURO, sin `server-only`:
 * lo importan tanto los servidores (que hacen cumplir el tope con compare-and-set sobre `reopen_count`) como los paneles de cliente.
 */

/** Máximo de reaperturas por pago, en la reserva y en el fee. Después de la 2.ª solo resuelve Soporte. */
export const MAX_PAYMENT_REOPENS = 2;

/** Horas sin respuesta a un aviso («Ya pagué» / «No pude realizar el pago») para escalar a todos los superadmin. Escala; no vence nada. */
export const ESCALATION_HOURS = 7 * 24;

/** `reopen_count` leído de la base (puede venir `null`/`undefined` en filas o entornos viejos). */
export function normalizeReopenCount(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function reopenCapReached(raw: unknown): boolean {
  return normalizeReopenCount(raw) >= MAX_PAYMENT_REOPENS;
}

/** Mensaje para la residencia cuando ya no puede volver a habilitar el pago de la reserva. */
export const RESIDENCE_REOPEN_CAP_MESSAGE =
  "Este pago ya se volvió a habilitar 2 veces. Ahora solo lo resuelve Soporte de EstuRed. Podés contactar al estudiante por WhatsApp.";

/** Mensaje para el admin cuando el fee ya se reabrió el máximo de veces. */
export const FEE_REOPEN_CAP_MESSAGE =
  "Este pago ya se reabrió 2 veces. Ahora solo se resuelve desde Soporte: validá el pago si lo recibiste o resolvelo en el caso de Soporte.";
