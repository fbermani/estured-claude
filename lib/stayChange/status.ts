/**
 * Aviso "Quiero cambiar" (DR3, Ciclo 59) — estados técnicos oficiales de `docs/04` §12bis.2 y copy visible.
 *
 * Funciones PURAS (sin Supabase, sin `server-only`): sirven a server actions, pantallas y tests. El usuario nunca
 * ve los strings técnicos (`open`, `cancelled_by_student`…): la UI usa `describeStayChangeState` (mismo criterio
 * que `StatusTag` para la disponibilidad).
 *
 * `pending_guardian_confirmation` NO está en `docs/04`: es un SUPUESTO REVERSIBLE (decisión del dueño sobre
 * menores): el menor inicia el aviso, pero no se envía a la residencia ni rige la excepción a DR1 hasta que su
 * familiar vinculado lo confirma (ver cabecera de `db/migrations/0044_stay_change_intents.sql`).
 */

export const STAY_CHANGE_STATUSES = [
  "pending_guardian_confirmation",
  "open",
  "cancelled_by_student",
  "resolved_new_reservation",
  "expired",
] as const;

export type StayChangeStatus = (typeof STAY_CHANGE_STATUSES)[number];

/** Avisos "vivos": ocupan el cupo único por estudiante (índice parcial de la migración 0044). */
export const ACTIVE_STAY_CHANGE_STATUSES: readonly StayChangeStatus[] = ["pending_guardian_confirmation", "open"];

/** Vencimiento del aviso (docs/04 §12bis.3, supuesto confirmado por el dueño) y recordatorio previo. */
export const STAY_CHANGE_EXPIRY_DAYS = 90;
/** Anti-spam: 1 aviso nuevo por estudiante cada 24 h; hasta 5 ediciones por aviso; sin re-notificar ediciones dentro de 30 min. */
export const STAY_CHANGE_CREATE_COOLDOWN_HOURS = 24;
export const STAY_CHANGE_MAX_EDITS = 5;
export const STAY_CHANGE_EDIT_NOTIFY_MINUTES = 30;
export const STAY_CHANGE_REMINDER_DAYS_BEFORE = 10;

/** Solicitudes que NO se pueden cerrar al cancelar el aviso: ya hay pago a la residencia en curso o reserva en camino. */
export const PAYMENT_IN_PROGRESS_APPLICATION_STATUSES = [
  "residence_payment_pending",
  "residence_payment_reported",
  "converted_to_reservation",
  "disputed",
] as const;

/** Solicitudes que sí se cierran (`cancelled_by_student`) al cancelar o vencer el aviso: todavía sin pago iniciado. */
export const CLOSABLE_APPLICATION_STATUSES = [
  "submitted",
  "queued_for_place",
  "under_review",
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "paused_due_to_other_active_request",
] as const;

/** Listas de espera que se cierran (`removed_by_student`, motivo `stay_change_cancelled`). */
export const CLOSABLE_WAITLIST_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"] as const;

/** Motivos que se guardan en `waitlist_entries.removed_reason` / `application_requests.cancelled_reason`. */
export const STAY_CHANGE_CANCELLED_REASON = "stay_change_cancelled";
export const STAY_CHANGE_EXPIRED_REASON = "stay_change_expired";

export function isStayChangeStatus(value: unknown): value is StayChangeStatus {
  return typeof value === "string" && (STAY_CHANGE_STATUSES as readonly string[]).includes(value);
}

/** ¿Rige la excepción a DR1? Solo con el aviso `open` (para menores: ya confirmado por el familiar). */
export function grantsOverlapException(status: StayChangeStatus): boolean {
  return status === "open";
}

/** ¿La residencia actual ya puede verlo/responderlo? (Los pendientes de familiar no se le envían). */
export function isVisibleToResidence(status: StayChangeStatus): boolean {
  return status !== "pending_guardian_confirmation";
}

export function isTerminalStayChangeStatus(status: StayChangeStatus): boolean {
  return status === "cancelled_by_student" || status === "resolved_new_reservation" || status === "expired";
}

export type StayChangeUiKey =
  | "pending_family"
  | "open_no_response"
  | "open_responded"
  | "open_expiring"
  | "resolved"
  | "cancelled"
  | "expired";

export type StayChangeUiTone = "neutral" | "info" | "warning" | "success";

export type StayChangeUiState = {
  key: StayChangeUiKey;
  /** Chip corto (voseo). */
  label: string;
  tone: StayChangeUiTone;
  /** ¿Rige la excepción a DR1? */
  grantsException: boolean;
  /** ¿El estudiante puede cancelarlo / editarlo? */
  isActive: boolean;
  /** Días hasta el vencimiento (solo `open`), o `null`. */
  daysToExpiry: number | null;
};

/**
 * Estado visible del aviso. `open` con vencimiento a ≤ 10 días pasa a `open_expiring` ("Por vencer", día 80);
 * `open` con respuesta de la residencia vs. sin respuesta es lo que distingue los dos bloques de Mi residencia.
 */
export function describeStayChangeState(
  intent: { status: StayChangeStatus; residenceRespondedAt: string | null; expiresAt: string | null },
  now: Date = new Date(),
): StayChangeUiState {
  switch (intent.status) {
    case "pending_guardian_confirmation":
      return { key: "pending_family", label: "Pendiente de tu familiar", tone: "warning", grantsException: false, isActive: true, daysToExpiry: null };
    case "open": {
      const days = intent.expiresAt ? Math.ceil((new Date(intent.expiresAt).getTime() - now.getTime()) / 86_400_000) : null;
      if (days !== null && days <= STAY_CHANGE_REMINDER_DAYS_BEFORE) {
        return { key: "open_expiring", label: "Por vencer", tone: "warning", grantsException: true, isActive: true, daysToExpiry: days };
      }
      return intent.residenceRespondedAt
        ? { key: "open_responded", label: "Buscando un cambio", tone: "info", grantsException: true, isActive: true, daysToExpiry: days }
        : { key: "open_no_response", label: "Buscando un cambio", tone: "info", grantsException: true, isActive: true, daysToExpiry: days };
    }
    case "resolved_new_reservation":
      return { key: "resolved", label: "Resuelto", tone: "success", grantsException: false, isActive: false, daysToExpiry: null };
    case "cancelled_by_student":
      return { key: "cancelled", label: "Cancelado", tone: "neutral", grantsException: false, isActive: false, daysToExpiry: null };
    case "expired":
      return { key: "expired", label: "Vencido", tone: "neutral", grantsException: false, isActive: false, daysToExpiry: null };
  }
}

/** Fecha de vencimiento de un aviso que empieza (o se reconfirma) `from`. */
export function stayChangeExpiryFrom(from: Date): Date {
  return new Date(from.getTime() + STAY_CHANGE_EXPIRY_DAYS * 86_400_000);
}
