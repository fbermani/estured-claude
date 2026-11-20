/**
 * Ventana de envío de los push (DR61, punto 5): nunca antes de las 9:00 de Argentina.
 * Argentina no usa horario de verano (UTC-3 todo el año), así que alcanza con restar 3 h.
 */
export const PUSH_EARLIEST_HOUR_AR = 9;

export function argentinaHour(now: Date): number {
  return (now.getUTCHours() + 21) % 24;
}

/** `true` si ya se puede enviar; si no, el aviso queda en cola hasta la primera corrida del cron desde las 9:00. */
export function isPushSendWindowOpen(now: Date = new Date()): boolean {
  return argentinaHour(now) >= PUSH_EARLIEST_HOUR_AR;
}
