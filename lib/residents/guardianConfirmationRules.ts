/**
 * Reglas puras de la confirmación del tutor para la estadía de un menor (DR32). Sin base de datos: se testean solas.
 * Copy: sin promesas de disponibilidad; «Soporte», nunca «mediación». Al tutor solo se le dice nombre corto + residencia.
 */

export const GUARDIAN_CONFIRMATION_TTL_DAYS = 7;
export const GUARDIAN_REMINDER_AFTER_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type GuardianConfirmationStatus = "pending" | "confirmed" | "rejected" | "expired" | "cancelled";
export type GuardianConfirmationOrigin = "invite" | "residence_approval";

export function computeGuardianExpiry(now: Date): Date {
  return new Date(now.getTime() + GUARDIAN_CONFIRMATION_TTL_DAYS * DAY_MS);
}

/** Una confirmación `pending` cuyo plazo ya pasó no se puede confirmar ni rechazar (el job la marca `expired`). */
export function isGuardianConfirmationExpired(row: { status: string; expires_at: string }, now: Date): boolean {
  return row.status === "pending" && new Date(row.expires_at).getTime() <= now.getTime();
}

/** Recordatorio único al tutor a los 3 días de pedida, mientras siga pendiente y vigente. */
export function guardianNeedsReminder(row: { status: string; requested_at: string; expires_at: string; reminded_at: string | null }, now: Date): boolean {
  if (row.status !== "pending" || row.reminded_at) return false;
  if (isGuardianConfirmationExpired(row, now)) return false;
  return now.getTime() - new Date(row.requested_at).getTime() >= GUARDIAN_REMINDER_AFTER_DAYS * DAY_MS;
}

export const GUARDIAN_COPY = {
  requestedForGuardian: (student: string, residence: string) => ({
    title: `${student} pidió vincular su estadía`,
    body: `${student} pidió vincular su estadía en ${residence}. Confirmala o decinos que no es correcta desde tu inicio. Tenés ${GUARDIAN_CONFIRMATION_TTL_DAYS} días.`,
  }),
  reminderForGuardian: (student: string, residence: string) => ({
    title: `Falta tu confirmación de la estadía de ${student}`,
    body: `${student} está esperando que confirmes su estadía en ${residence}. Si no respondés, el pedido vence y no se activa nada.`,
  }),
  requestedForStudent: (residence: string) => ({
    title: "Esperando la confirmación de tu familiar",
    body: `Le avisamos a tu familiar para que confirme tu estadía en ${residence}. Hasta entonces no queda vinculada.`,
  }),
  confirmedForStudent: (residence: string) => ({
    title: "Tu familiar confirmó tu estadía",
    body: `Tu estadía en ${residence} quedó activa. Podés verla en Mi residencia.`,
  }),
  rejectedForStudent: (residence: string) => ({
    title: "Tu familiar no confirmó la estadía",
    body: `No se vinculó tu estadía en ${residence}. Hablalo con tu familiar o escribinos a Soporte.`,
  }),
  expiredForStudent: (residence: string) => ({
    title: "Venció el pedido de confirmación",
    body: `Tu familiar no respondió a tiempo y tu estadía en ${residence} no se vinculó. Podés pedirla de nuevo.`,
  }),
  expiredForGuardian: (student: string, residence: string) => ({
    title: "Venció el pedido de confirmación",
    body: `El pedido de ${student} para vincular su estadía en ${residence} venció y no se activó nada. Puede volver a pedirlo.`,
  }),
} as const;

export const GUARDIAN_ERRORS = {
  notGuardian: "Solo el familiar o tutor con vínculo activo puede responder este pedido.",
  notFound: "No encontramos ese pedido de confirmación.",
  alreadyResolved: "Este pedido ya fue respondido o venció.",
  changed: "La estadía cambió mientras tanto y el pedido se canceló. Avisale a tu familiar que lo pida de nuevo.",
  alreadyPending: "Ya hay un pedido de confirmación esperando a tu familiar.",
  generic: "No pudimos completar la acción. Intentá de nuevo.",
  unavailable: "Esta función todavía no está disponible en este entorno. Avisá a Soporte.",
} as const;
