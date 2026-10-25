/**
 * Seguimiento post-ingreso (DR14, docs/04 §12ter, docs/06 §15.3 y §27.12). Lógica PURA, sin base de datos ni `server-only`.
 * Los plazos son supuestos reversibles ya documentados (docs/04 §12ter.2): 5 días tras el inicio efectivo, 14 días sin respuesta.
 */

export const FOLLOWUP_DAYS_AFTER_START = 5;
export const FOLLOWUP_NO_RESPONSE_DAYS = 14;
/**
 * Supuesto reversible: el job solo programa seguimientos de estadías cuyo inicio fue en los últimos N días (o futuro), para que activar
 * el job en una base con estadías viejas no dispare avisos a residencias por ingresos de hace meses.
 */
export const FOLLOWUP_DISCOVERY_LOOKBACK_DAYS = 14;

const DAY_MS = 86_400_000;

export type StayFollowupStatus = "scheduled" | "sent" | "answered" | "no_response" | "reviewed" | "cancelled";

export const FOLLOWUP_STATUS_LABELS: Record<StayFollowupStatus, string> = {
  scheduled: "Programado",
  sent: "Enviado",
  answered: "Respondido",
  no_response: "Sin respuesta",
  reviewed: "Revisado",
  cancelled: "Cancelado",
};

export const FOLLOWUP_TERMINAL_STATUSES: StayFollowupStatus[] = ["no_response", "reviewed", "cancelled"];

/** Estados de estadía que cuentan como "vigente" para programar o enviar (docs/04 §12ter.3: la estadía sigue activa). */
export const LIVE_STAY_STATUSES = ["active", "visibility_limited", "hidden_by_user", "pending_activation"] as const;

export const HOW_IS_IT_GOING_OPTIONS = [
  { value: "very_well", label: "Muy bien" },
  { value: "well", label: "Bien" },
  { value: "so_so", label: "Más o menos" },
  { value: "not_well", label: "No muy bien" },
] as const;
export const WAS_AS_EXPECTED_OPTIONS = [
  { value: "yes", label: "Sí" },
  { value: "partly", label: "En parte" },
  { value: "no", label: "No" },
] as const;

export type HowIsItGoing = (typeof HOW_IS_IT_GOING_OPTIONS)[number]["value"];
export type WasAsExpected = (typeof WAS_AS_EXPECTED_OPTIONS)[number]["value"];

export function howIsItGoingLabel(value: string): string {
  return HOW_IS_IT_GOING_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
export function wasAsExpectedLabel(value: string): string {
  return WAS_AS_EXPECTED_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * `due_at` = inicio efectivo + 5 días. `start_date` es una fecha (YYYY-MM-DD, calendario de Argentina): se toma la medianoche de
 * Buenos Aires (03:00 UTC) para que el día cuente completo. Devuelve null si la fecha es inválida.
 */
export function computeDueAt(startDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const start = new Date(`${startDate}T03:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + FOLLOWUP_DAYS_AFTER_START * DAY_MS);
}

/** Fecha (YYYY-MM-DD) de "hoy" en Buenos Aires para comparar con `start_date`/`end_date`. */
export function todayInBuenosAires(now: Date): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** ¿La estadía sigue vigente? Estado vivo, `is_current` y sin `end_date` pasada. */
export function isStayLive(
  stay: { status: string; is_current: boolean | null; end_date: string | null },
  now: Date,
): boolean {
  if (!(LIVE_STAY_STATUSES as readonly string[]).includes(stay.status)) return false;
  if (stay.is_current === false) return false;
  if (stay.end_date && stay.end_date <= todayInBuenosAires(now)) return false;
  return true;
}

/** ¿Ya pasaron los 14 días desde `sent` sin respuesta? */
export function isNoResponseDue(sentAt: string | null, now: Date): boolean {
  if (!sentAt) return false;
  return new Date(sentAt).getTime() + FOLLOWUP_NO_RESPONSE_DAYS * DAY_MS <= now.getTime();
}

/** Primer día (YYYY-MM-DD) desde el cual el job programa estadías (ventana de descubrimiento). */
export function discoveryFloorDate(now: Date): string {
  const d = new Date(now.getTime() - 3 * 3_600_000 - FOLLOWUP_DISCOVERY_LOOKBACK_DAYS * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** Copy del recordatorio a la residencia: nunca incluye estado ni contenido de la respuesta (docs/04 §12ter.4). */
export const RESIDENCE_REMINDER = {
  title: "Pasaron 5 días del ingreso: consultale cómo viene su estadía",
  body: (name: string) =>
    `${name} ingresó hace 5 días. Es un buen momento para preguntarle por tu cuenta cómo viene todo y si necesita algo.`,
};

export const STUDENT_SURVEY = {
  title: "¿Cómo viene tu estadía?",
  body: "Contanos en un minuto cómo va todo hasta ahora. Tu respuesta es privada: la residencia no la ve.",
  guardianTitle: (name: string) => `¿Cómo viene la estadía de ${name}?`,
  guardianBody: "Contanos cómo ve todo hasta ahora. Tu respuesta es privada: la residencia no la ve.",
};

export function validateFollowupAnswers(input: {
  howIsItGoing: string;
  wasAsExpected: string;
  comment: string;
}): { ok: true; comment: string | null } | { ok: false; error: string } {
  if (!HOW_IS_IT_GOING_OPTIONS.some((o) => o.value === input.howIsItGoing)) {
    return { ok: false, error: "Elegí cómo va todo hasta ahora." };
  }
  if (!WAS_AS_EXPECTED_OPTIONS.some((o) => o.value === input.wasAsExpected)) {
    return { ok: false, error: "Elegí si era lo que esperabas." };
  }
  const comment = input.comment.trim();
  if (comment.length > 1000) return { ok: false, error: "El comentario puede tener hasta 1000 caracteres." };
  return { ok: true, comment: comment || null };
}
