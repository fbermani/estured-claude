/**
 * Copy oficial de los 14 estados de `application_requests`
 * (docs/04_STATE_MACHINES.md) — compartido entre el listado
 * `/students/applications` y el detalle `/students/applications/[id]`
 * para que el resumen de la card y la pantalla de detalle nunca digan
 * cosas distintas del mismo estado.
 */
export const APPLICATION_STATUS_COPY: Record<
  string,
  { label: string; tone: "amber" | "sage" | "neutral"; helper: string }
> = {
  submitted: {
    label: "Enviada — esperando respuesta",
    tone: "amber",
    helper: "La residencia tiene 48 horas para responder desde que enviaste tu solicitud.",
  },
  queued_for_place: {
    label: "En cola para este tipo de habitación",
    tone: "neutral",
    helper:
      'Este tipo de habitación ya tiene el máximo de solicitudes visibles para la residencia. Vas a pasar a "Enviada" automáticamente cuando se libere un lugar.',
  },
  under_review: {
    label: "En revisión",
    tone: "amber",
    helper: "La residencia está revisando tu solicitud.",
  },
  contact_established: {
    label: "Contacto establecido",
    tone: "sage",
    helper: "La residencia va a escribirte por WhatsApp para coordinar los próximos pasos.",
  },
  offer_pending_student_acceptance: {
    label: "Te propusieron un ajuste",
    tone: "amber",
    helper: "La residencia propuso un cambio en las condiciones. Revisalo y decidí.",
  },
  conditions_accepted: {
    label: "Condiciones aceptadas",
    tone: "sage",
    helper: "Ya acordaste las condiciones finales. El pago a la residencia se habilita en la próxima etapa.",
  },
  residence_payment_pending: {
    label: "Pagá a la residencia",
    tone: "amber",
    helper: "Coordiná el pago directamente con la residencia (fuera de EstuRed). Cuando lo reciba, ella lo va a marcar acá.",
  },
  residence_payment_reported: {
    label: "Pago informado por la residencia",
    tone: "sage",
    helper: "La residencia confirmó que recibió tu pago. Tu reserva se está creando.",
  },
  converted_to_reservation: {
    label: "Reserva creada",
    tone: "sage",
    helper: "La residencia confirmó tu pago. Ya podés pagar el fee EstuRed para confirmar tu reserva.",
  },
  paused_due_to_other_active_request: {
    label: "Pausada",
    tone: "neutral",
    helper: "Otra de tus solicitudes avanzó primero. Esta queda en espera, no fue cancelada.",
  },
  rejected: {
    label: "Rechazada",
    tone: "neutral",
    helper: "La residencia no pudo avanzar con esta solicitud.",
  },
  expired_no_residence_response: {
    label: "Vencida — sin respuesta",
    tone: "neutral",
    helper: "La residencia no respondió dentro de las 48 horas.",
  },
  expired_offer_no_response: {
    label: "Vencida — no respondiste a tiempo",
    tone: "neutral",
    helper: "No respondiste la propuesta de ajuste dentro de las 48 horas.",
  },
  cancelled_by_student: {
    label: "Cancelada por vos",
    tone: "neutral",
    helper: "Cancelaste esta solicitud.",
  },
};

/** El estudiante tiene algo concreto que hacer ahora — se muestran primero y con más peso visual. */
export const APPLICATION_ACTION_REQUIRED_STATUSES = new Set(["offer_pending_student_acceptance", "residence_payment_pending"]);
