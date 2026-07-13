/** Subconjunto de application_status usado en la fase 1 (docs/06 §4.5). */
export type ApplicationStatus =
  | "submitted"
  | "queued_for_place"
  | "under_review"
  | "contact_established"
  | "paused_due_to_other_active_request"
  | "rejected"
  | "expired_no_residence_response"
  | "cancelled_by_student";

/**
 * Solicitudes que cuentan para el máximo de 2 activas (docs/00 §9) y que
 * se pausan cuando otra solicitud del mismo estudiante avanza (docs/04
 * §5.4). Incluye `queued_for_place` (docs/04 §5.2: "cuenta como
 * solicitud activa: Sí") — un estudiante en cola sigue ocupando uno de
 * sus 2 cupos.
 */
export const ACTIVE_APPLICATION_STATUSES = [
  "submitted",
  "queued_for_place",
  "under_review",
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "paused_due_to_other_active_request",
  "residence_payment_pending",
  "residence_payment_reported",
];

/**
 * Subconjunto de `ACTIVE_APPLICATION_STATUSES` que ocupa uno de los 3
 * cupos visibles de un tipo de habitación (docs/03 §10.3-10.4) — todo
 * lo "activo" menos `queued_for_place`, que es la cola misma.
 */
export const ROOM_TYPE_VISIBLE_STATUSES = ACTIVE_APPLICATION_STATUSES.filter(
  (status) => status !== "queued_for_place",
);

export const REJECTION_REASONS = [
  { value: "no_availability", label: "Sin disponibilidad" },
  { value: "profile_incomplete", label: "Perfil incompleto" },
  { value: "does_not_meet_criteria", label: "No cumple los criterios de la residencia" },
  { value: "already_assigned", label: "La plaza ya fue asignada" },
  { value: "dates_incompatible", label: "Fechas incompatibles" },
  { value: "duration_incompatible", label: "Duración incompatible" },
  { value: "residence_paused", label: "Residencia pausada temporalmente" },
  { value: "other", label: "Otro motivo" },
] as const;
