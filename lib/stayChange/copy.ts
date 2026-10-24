/**
 * Copy fijo del flujo "Quiero cambiar" (DR3, Ciclo 59). Un solo lugar, mismo criterio que `StatusTag` para la
 * disponibilidad: las pantallas y las notificaciones lo importan, no lo reescriben. Sin promesas, sin "mediación".
 */

/**
 * Texto OBLIGATORIO (dueño, 2026-10-23) en el aviso al estudiante, en la respuesta de la residencia y en el cierre de la
 * salida. EstuRed es plataforma intermediaria: no responde por cobros.
 */
export const UNPAID_DISCLAIMER =
  "EstuRed no se responsabiliza por mensualidades impagas, incobrables o morosos, bajo ninguna circunstancia; la residencia es responsable de cobrar lo que corresponda antes de que el estudiante se retire.";

/** Señal que ve la residencia NUEVA en la bandeja y el detalle de la solicitud (sin residencia de origen ni motivo). */
export const MOVING_SIGNAL_LABEL = "En proceso de mudanza";

/** Campo opcional del formulario de la solicitud nueva. */
export const MOVING_NOTE_LABEL = "Si querés, contale a la residencia desde dónde te mudás y por qué";
export const MOVING_NOTE_HELP = "Es voluntario. Solo lo ve esta residencia, en esta solicitud; no se comparte con ninguna otra.";
export const MAX_MOVING_NOTE = 500;

/** Quién inicia la salida (regla del dueño): siempre la residencia actual. */
export const EXIT_INITIATED_BY_RESIDENCE_NOTE =
  "Avisar que querés cambiar no cierra tu estadía: la baja la registra tu residencia actual cuando corresponda.";

export const DEPOSIT_STATUS_LABELS = {
  returned: "Depósito devuelto",
  not_returned: "Depósito no devuelto",
  no_deposit: "Sin depósito",
} as const;
export type DepositReturnStatus = keyof typeof DEPOSIT_STATUS_LABELS;

/**
 * Señal que ve la residencia que RECIBE una solicitud/lista (DR3b): derivada de `stay_change_intent_id`. Expone solo
 * "en proceso de mudanza" y la nota voluntaria del estudiante; nunca el aviso, la residencia de origen ni el motivo.
 */
export function movingSignalFor(row: { stay_change_intent_id?: string | null; move_context_note?: string | null }): { label: string; note: string | null } | null {
  if (!row.stay_change_intent_id) return null;
  return { label: MOVING_SIGNAL_LABEL, note: row.move_context_note?.trim() || null };
}
