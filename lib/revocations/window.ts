/**
 * Plazo de revocación del fee EstuRed (docs/04 §8.9, DR6): 10 días corridos desde `paid_at`.
 * Funciones puras (sin `server-only`): las usan la acción del estudiante, la pantalla del estudiante, el panel admin y los tests.
 */
export const REVOCATION_WINDOW_DAYS = 10;

const DAY_MS = 24 * 3_600_000;

function toMs(value: string | Date): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/** Días (fraccionarios) entre dos instantes. */
export function daysBetween(from: string | Date, to: string | Date): number {
  return (toMs(to) - toMs(from)) / DAY_MS;
}

export type RevocationWindow = {
  /** `true` si la revocación se registró antes de cumplirse los 10 días corridos desde el pago (mismo criterio que el servidor del estudiante). */
  withinWindow: boolean;
  /** Días enteros transcurridos entre el pago y la revocación. */
  daysElapsed: number;
  /** "Día N de 10" (1 a ...): el día del plazo en que se revocó. */
  dayNumber: number;
  /** Instante en que vencía el plazo (`paid_at` + 10 días). */
  deadline: Date;
};

/** Calcula el plazo midiendo hasta el momento de la revocación (`reservations.cancelled_at`), no hasta ahora. */
export function computeRevocationWindow(paidAt: string | Date, revokedAt: string | Date): RevocationWindow {
  const elapsed = daysBetween(paidAt, revokedAt);
  return {
    withinWindow: elapsed < REVOCATION_WINDOW_DAYS,
    daysElapsed: Math.max(0, Math.floor(elapsed)),
    dayNumber: Math.max(1, Math.floor(elapsed) + 1),
    deadline: new Date(toMs(paidAt) + REVOCATION_WINDOW_DAYS * DAY_MS),
  };
}

/** Días que le quedan al estudiante para ejercer el derecho (0 si ya venció). */
export function revocationDaysRemaining(paidAt: string | Date, now: string | Date = new Date()): number {
  return Math.max(0, Math.ceil(REVOCATION_WINDOW_DAYS - daysBetween(paidAt, now)));
}

/** ¿Todavía puede el estudiante ejercer el derecho? (el servidor bloquea con `>= 10` días). */
export function isRevocationWindowOpen(paidAt: string | Date, now: string | Date = new Date()): boolean {
  return daysBetween(paidAt, now) < REVOCATION_WINDOW_DAYS;
}

/** Antigüedad entera, en días, de una revocación sin resolver. */
export function pendingAgeDays(revokedAt: string | Date, now: string | Date = new Date()): number {
  return Math.max(0, Math.floor(daysBetween(revokedAt, now)));
}

/** "Día N de 10" dentro de plazo; "fuera de plazo (día N)" si no (sin "de 10", que no tiene sentido pasado el plazo). */
export function describeRevocationDay(window: Pick<RevocationWindow, "withinWindow" | "dayNumber">): string {
  return window.withinWindow ? `día ${window.dayNumber} de ${REVOCATION_WINDOW_DAYS}` : `fuera de plazo (día ${window.dayNumber})`;
}
