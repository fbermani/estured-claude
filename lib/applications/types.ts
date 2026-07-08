/** Subconjunto de application_status usado en la fase 1 (docs/06 §4.5). */
export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "contact_established"
  | "paused_due_to_other_active_request"
  | "rejected"
  | "expired_no_residence_response"
  | "cancelled_by_student";

/** Solicitudes que cuentan para el máximo de 2 activas (docs/00 §9). */
export const ACTIVE_APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "paused_due_to_other_active_request",
  "residence_payment_pending",
  "residence_payment_reported",
];

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
