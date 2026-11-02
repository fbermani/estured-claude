import { BUSINESS_TIME_ZONE } from "@/lib/applications/reservationMoney";

/**
 * Lógica pura de los avisos de llegada (DR29, lote 2B): qué aviso toca hoy y a quién. Sin acceso a datos.
 * Cadencia cerrada por el dueño: estudiante a 14/7/2/0 días del ingreso; familiar vinculado ACTIVO solo a 7 y 2.
 */

export type ReminderKey = "t14" | "t7" | "t2" | "t0";
export type ReminderRecipientKind = "student" | "family";

export const REMINDER_DAYS: Record<ReminderKey, number> = { t14: 14, t7: 7, t2: 2, t0: 0 };
export const REMINDER_KEYS_BY_RECIPIENT: Record<ReminderRecipientKind, readonly ReminderKey[]> = {
  student: ["t14", "t7", "t2", "t0"],
  family: ["t7", "t2"],
};
/** Hora mínima (Argentina) para mandar avisos. */
export const REMINDER_MIN_HOUR = 9;
/** Estados de reserva que reciben avisos. */
export const REMINDER_RESERVATION_STATUSES = ["confirmed", "receipt_pending", "receipt_issued"] as const;

/** Aviso que corresponde a `daysLeft` días del ingreso, o null si hoy no toca ninguno. */
export function reminderKeyForDays(daysLeft: number | null): ReminderKey | null {
  if (daysLeft === null) return null;
  for (const key of Object.keys(REMINDER_DAYS) as ReminderKey[]) if (REMINDER_DAYS[key] === daysLeft) return key;
  return null;
}

/** ¿Ya son las 9:00 (o más) en Argentina? */
export function isReminderHour(now: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .find((p) => p.type === "hour")?.value,
  );
  return Number.isFinite(hour) && hour >= REMINDER_MIN_HOUR;
}

export function isReminderReservationStatus(status: string): boolean {
  return (REMINDER_RESERVATION_STATUSES as readonly string[]).includes(status);
}

/** ¿Este tipo de destinatario recibe este aviso? (familiar: solo t7 y t2) */
export function recipientGetsReminder(kind: ReminderRecipientKind, key: ReminderKey): boolean {
  return REMINDER_KEYS_BY_RECIPIENT[kind].includes(key);
}

/** Código de error de la base cuando la fila ya existe (unique) → el aviso ya salió. */
export function isDuplicateSend(error: { code?: string } | null): boolean {
  return !!error && error.code === "23505";
}
/** Tabla ausente (migración 0069 sin aplicar). */
export function isMissingSendsTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "PGRST205" || error.code === "42P01");
}
