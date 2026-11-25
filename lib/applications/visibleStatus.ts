/**
 * Estado VISIBLE de una solicitud + su reserva asociada (auditoría
 * 2026-10-20, H01).
 *
 * Problema que resuelve: `application_requests.status` queda en
 * `converted_to_reservation` para siempre, aunque la reserva después se
 * confirme, se cancele o venza. Cada pantalla leía solo el estado de la
 * solicitud (o, a lo sumo, distinguía `confirmed`), así que una reserva
 * cancelada o con el fee vencido se mostraba como "Reserva creada — ya
 * podés pagar el fee". Este helper es la ÚNICA fuente del rótulo que ven
 * estudiante, residencia y admin: cuando existe reserva, el estado de la
 * reserva manda (docs/04 §2.1 y §2.2: solicitud y reserva son entidades
 * separadas).
 *
 * Es presentación pura: no cambia reglas de negocio ni transiciones de
 * estado, y no consulta nada (recibe los estados ya leídos). Los strings
 * de estado son los oficiales de docs/04 (§5.2 solicitud, §7.2 reserva,
 * §8.2 fee). El copy de DISPONIBILIDAD no vive acá, sino solo en
 * `components/ui/StatusTag.tsx`.
 *
 * Copy: voseo para el estudiante, "Soporte" (nunca "mediación"), sin
 * prometer disponibilidad y sin culpar al usuario en reservas
 * canceladas/vencidas.
 */

export type VisibleStatusViewer = "student" | "residence" | "admin";
export type VisibleStatusTone = "amber" | "sage" | "neutral" | "danger";

/** Acción siguiente sugerida al ESTUDIANTE (las pantallas la traducen a un link). */
export type VisibleStatusNextAction =
  | "respond_offer"
  | "pay_residence"
  | "pay_fee"
  | "view_fee_status"
  | "view_receipt"
  | "contact_support";

export type ReservationStatusInput = {
  /** `reservations.status` (docs/04 §7.2). */
  status: string;
  /** `reservations.cancellation_reason_code`; `student_revocation_right` = revocación del fee. */
  cancellationReasonCode?: string | null;
  /** `estured_fee_payments.status` (docs/04 §8.2) de la reserva, si se conoce. */
  feePaymentStatus?: string | null;
  /** Si el comprobante ya existe (`reservations.booking_receipt_id`). */
  hasReceipt?: boolean;
};

export type VisibleStatus = {
  /** Clave estable de la rama elegida (para tests, agrupar y analítica). */
  key: string;
  label: string;
  tone: VisibleStatusTone;
  /** Texto corto con la explicación y, cuando corresponde, la acción siguiente. "" si no hace falta. */
  helper: string;
  /** De dónde sale el rótulo: la solicitud o la reserva asociada. */
  source: "application" | "reservation";
  /** El estudiante tiene algo concreto que hacer ahora. */
  studentActionRequired: boolean;
  /** Estado terminal: ya no avanza (cerrada, vencida, cancelada, etc.). */
  isClosed: boolean;
  nextAction: VisibleStatusNextAction | null;
};

type Copy = { label: string; helper?: string };
type Entry = {
  tone: VisibleStatusTone;
  closed?: boolean;
  studentAction?: boolean;
  nextAction?: VisibleStatusNextAction;
  student: Copy;
  residence: Copy;
  admin: Copy;
};

const SUPPORT_HINT = "Si querés retomarla, escribinos a Soporte y vemos cómo ayudarte.";

/* -------------------------------------------------------------------------- */
/* Solicitud (docs/04 §5.2 / §5.3)                                            */
/* -------------------------------------------------------------------------- */

const APPLICATION_STATUS: Record<string, Entry> = {
  draft: {
    tone: "neutral",
    student: { label: "Solicitud en preparación" },
    residence: { label: "Borrador" },
    admin: { label: "Borrador" },
  },
  submitted: {
    tone: "amber",
    student: {
      label: "Enviada — esperando respuesta",
      helper: "La residencia tiene 48 horas para responder desde que enviaste tu solicitud.",
    },
    residence: { label: "Nueva", helper: "Tenés 48 horas para responder esta solicitud." },
    admin: { label: "Nueva" },
  },
  queued_for_place: {
    tone: "neutral",
    student: {
      label: "En cola para este tipo de habitación",
      helper:
        'Este tipo de habitación ya tiene el máximo de solicitudes visibles para la residencia. Vas a pasar a "Enviada" automáticamente cuando se libere un lugar.',
    },
    residence: { label: "En cola" },
    admin: { label: "En cola" },
  },
  under_review: {
    tone: "amber",
    student: { label: "En revisión", helper: "La residencia está revisando tu solicitud." },
    residence: { label: "En revisión" },
    admin: { label: "En revisión" },
  },
  contact_established: {
    tone: "sage",
    student: {
      label: "Contacto establecido",
      helper: "La residencia va a indicarte los próximos pasos.",
    },
    residence: { label: "Contacto establecido" },
    admin: { label: "Contacto establecido" },
  },
  offer_pending_student_acceptance: {
    tone: "amber",
    studentAction: true,
    nextAction: "respond_offer",
    student: {
      label: "Te propusieron un ajuste",
      helper: "La residencia propuso un cambio en las condiciones. Revisalo y decidí.",
    },
    residence: { label: "Propuesta enviada", helper: "Esperando la respuesta del estudiante a tu propuesta de ajuste." },
    admin: { label: "Propuesta enviada" },
  },
  conditions_accepted: {
    tone: "sage",
    student: {
      label: "Condiciones aceptadas",
      helper: "Ya acordaste las condiciones finales. El pago a la residencia se habilita en la próxima etapa.",
    },
    residence: { label: "Condiciones aceptadas" },
    admin: { label: "Condiciones aceptadas" },
  },
  paused_due_to_other_active_request: {
    tone: "neutral",
    student: {
      label: "Pausada",
      helper: "Otra de tus solicitudes avanzó primero. Esta queda en espera, no fue cancelada.",
    },
    residence: { label: "Pausada" },
    admin: { label: "Pausada" },
  },
  residence_payment_pending: {
    tone: "amber",
    studentAction: true,
    nextAction: "pay_residence",
    student: {
      label: "Pagá a la residencia",
      helper:
        "Mirá más abajo cómo pagar o cómo te va a contactar la residencia. El pago es fuera de EstuRed: cuando lo reciba, ella lo marca acá.",
    },
    residence: {
      label: "Esperando pago del estudiante",
      helper: "Cuando recibas el pago, confirmalo acá para que se cree la reserva.",
    },
    admin: { label: "Esperando pago a la residencia" },
  },
  residence_payment_reported: {
    tone: "sage",
    student: {
      label: "Pago informado por la residencia",
      helper: "La residencia confirmó que recibió tu pago. Tu reserva se está creando.",
    },
    residence: { label: "Pago recibido" },
    admin: { label: "Pago recibido" },
  },
  // Sin reserva legible (error de lectura o dato faltante): rótulo oficial de docs/04 §5.3.
  converted_to_reservation: {
    tone: "sage",
    student: {
      label: "Reserva en proceso",
      helper: "Tu solicitud ya generó una reserva. Entrá al detalle para ver cómo sigue.",
    },
    residence: { label: "Reserva en proceso" },
    admin: { label: "Reserva en proceso" },
  },
  rejected: {
    tone: "neutral",
    closed: true,
    student: { label: "Rechazada", helper: "La residencia no pudo avanzar con esta solicitud." },
    residence: { label: "Rechazada" },
    admin: { label: "Rechazada" },
  },
  expired_no_residence_response: {
    tone: "neutral",
    closed: true,
    student: { label: "Vencida — sin respuesta", helper: "La residencia no respondió dentro de las 48 horas." },
    residence: { label: "Vencida — sin respuesta", helper: "Venció el plazo de 48 horas para responder esta solicitud." },
    admin: { label: "Vencida — sin respuesta", helper: "La residencia no respondió dentro de las 48 horas." },
  },
  expired_no_student_payment: {
    tone: "neutral",
    closed: true,
    student: {
      label: "Vencida — sin pago a la residencia",
      helper: `No se registró el pago a la residencia dentro de las 48 horas. ${SUPPORT_HINT}`,
    },
    residence: { label: "Vencida — sin pago a la residencia", helper: "El estudiante no pagó a la residencia dentro de las 48 horas." },
    admin: { label: "Vencida — sin pago a la residencia", helper: "No se registró el pago a la residencia dentro de las 48 horas." },
  },
  expired_offer_no_response: {
    tone: "neutral",
    closed: true,
    student: {
      label: "Vencida — propuesta sin respuesta",
      helper: "No respondiste la propuesta de ajuste dentro de las 48 horas.",
    },
    residence: { label: "Vencida — propuesta sin respuesta", helper: "El estudiante no respondió tu propuesta de ajuste dentro de las 48 horas." },
    admin: { label: "Vencida — propuesta sin respuesta", helper: "El estudiante no respondió la propuesta de ajuste dentro de las 48 horas." },
  },
  cancelled_by_student: {
    tone: "neutral",
    closed: true,
    student: { label: "Cancelada por vos", helper: "Cancelaste esta solicitud." },
    residence: { label: "Cancelada por el estudiante" },
    admin: { label: "Cancelada por el estudiante" },
  },
  cancelled_by_residence: {
    tone: "neutral",
    closed: true,
    student: { label: "Cancelada por la residencia", helper: "La residencia canceló esta solicitud." },
    residence: { label: "Cancelada por la residencia" },
    admin: { label: "Cancelada por la residencia" },
  },
  closed_due_to_other_confirmed_reservation: {
    tone: "neutral",
    closed: true,
    student: {
      label: "Cerrada por otra reserva confirmada",
      helper: "Se cerró porque confirmaste una reserva en otra residencia.",
    },
    residence: { label: "Cerrada automáticamente" },
    admin: { label: "Cerrada por otra reserva confirmada" },
  },
  disputed: {
    tone: "amber",
    student: { label: "En revisión por EstuRed", helper: "Hay un reclamo abierto sobre esta solicitud. Soporte lo está revisando." },
    residence: { label: "En revisión por EstuRed" },
    admin: { label: "En disputa" },
  },
};

/* -------------------------------------------------------------------------- */
/* Reserva (docs/04 §7.2) — manda sobre la solicitud cuando existe            */
/* -------------------------------------------------------------------------- */

const RESERVATION_STATUS: Record<string, Entry> = {
  pending_estured_fee: {
    tone: "amber",
    studentAction: true,
    nextAction: "pay_fee",
    student: {
      label: "Pagá el fee EstuRed",
      helper:
        "La residencia ya informó tu pago. Para confirmar tu reserva falta pagar el fee EstuRed antes de que venza el plazo.",
    },
    residence: {
      label: "Reserva — esperando fee del estudiante",
      helper: "Marcaste el pago como recibido. La reserva se confirma cuando el estudiante pague el fee EstuRed.",
    },
    admin: { label: "Reserva — fee pendiente" },
  },
  estured_fee_processing: {
    tone: "amber",
    student: { label: "Fee en proceso", helper: "Estamos procesando el pago del fee. No hace falta que hagas nada más por ahora." },
    residence: { label: "Reserva — fee en proceso", helper: "El pago del fee del estudiante se está procesando." },
    admin: { label: "Reserva — fee en proceso" },
  },
  estured_fee_failed: {
    tone: "danger",
    nextAction: "contact_support",
    student: {
      label: "El pago del fee falló",
      helper: "El último intento de pago del fee no se pudo completar. Escribile a Soporte y lo revisamos juntos.",
    },
    residence: { label: "Reserva — falló el pago del fee", helper: "No se pudo cobrar el fee del estudiante. EstuRed lo está revisando." },
    admin: { label: "Reserva — falló el pago del fee" },
  },
  expired_fee_unpaid: {
    tone: "neutral",
    closed: true,
    nextAction: "contact_support",
    student: {
      label: "Reserva vencida",
      helper: `El plazo para pagar el fee EstuRed terminó y esta reserva ya no está vigente. ${SUPPORT_HINT}`,
    },
    residence: {
      label: "Reserva vencida",
      helper: "El fee EstuRed no se pagó a tiempo, así que esta reserva no se confirmó. Podés liberar la plaza.",
    },
    admin: { label: "Reserva vencida", helper: "El fee EstuRed no se pagó dentro del plazo y la reserva no se confirmó." },
  },
  confirmed: {
    tone: "sage",
    student: { label: "Reserva confirmada", helper: "Ya pagaste el fee EstuRed: tu reserva está confirmada." },
    residence: { label: "Reserva confirmada", helper: "El estudiante ya pagó el fee EstuRed." },
    admin: { label: "Reserva confirmada" },
  },
  receipt_pending: {
    tone: "sage",
    student: {
      label: "Reserva confirmada",
      helper: "Tu reserva está confirmada. Estamos generando tu comprobante y lo vas a ver acá cuando esté listo.",
    },
    residence: { label: "Reserva confirmada", helper: "El comprobante todavía se está generando." },
    admin: { label: "Reserva confirmada — comprobante pendiente" },
  },
  receipt_issued: {
    tone: "sage",
    student: { label: "Reserva confirmada", helper: "Tu reserva está confirmada y tu comprobante ya está disponible." },
    residence: { label: "Reserva confirmada" },
    admin: { label: "Reserva confirmada — comprobante emitido" },
  },
  cancelled_by_student: {
    tone: "neutral",
    closed: true,
    nextAction: "contact_support",
    student: {
      label: "Reserva cancelada por vos",
      helper:
        "Cancelaste esta reserva. Si querés volver a intentarlo, podés enviar una nueva solicitud, o escribirle a Soporte si tenés dudas.",
    },
    residence: {
      label: "Reserva cancelada por el estudiante",
      helper: "Si la plaza estaba retenida para este estudiante, revisá tu disponibilidad.",
    },
    admin: { label: "Reserva cancelada por el estudiante" },
  },
  cancelled_by_residence: {
    tone: "neutral",
    closed: true,
    nextAction: "contact_support",
    student: {
      label: "Reserva cancelada por la residencia",
      helper: "La residencia canceló esta reserva. Escribinos a Soporte y vemos cómo ayudarte a seguir con tu búsqueda.",
    },
    residence: { label: "Reserva cancelada por la residencia" },
    admin: { label: "Reserva cancelada por la residencia" },
  },
  no_show: {
    tone: "neutral",
    closed: true,
    nextAction: "contact_support",
    student: {
      label: "Ingreso no concretado",
      helper: "La residencia registró que no se concretó el ingreso en la fecha acordada. Si hubo un error, escribinos a Soporte.",
    },
    residence: { label: "No se presentó (no-show)" },
    admin: { label: "No-show" },
  },
  completed: {
    tone: "neutral",
    closed: true,
    student: { label: "Estadía finalizada" },
    residence: { label: "Estadía finalizada" },
    admin: { label: "Estadía finalizada" },
  },
  disputed: {
    tone: "amber",
    nextAction: "contact_support",
    student: { label: "En revisión por EstuRed", helper: "Hay un reclamo abierto sobre esta reserva. Soporte lo está revisando." },
    residence: { label: "En revisión por EstuRed" },
    admin: { label: "Reserva en disputa" },
  },
};

/** Reserva cancelada por el derecho de revocación del fee (docs/04 §7.3): mismo estado técnico, copy propio. */
const REVOKED_RESERVATION: Entry = {
  tone: "neutral",
  closed: true,
  nextAction: "contact_support",
  student: {
    label: "Reserva revocada por vos",
    helper:
      "Ejerciste tu derecho de revocación y la reserva quedó sin efecto. Si querés volver a intentarlo, podés enviar una nueva solicitud, o escribirle a Soporte si tenés dudas.",
  },
  residence: {
    label: "Reserva revocada por el estudiante",
    helper: "Si la plaza estaba retenida para este estudiante, revisá tu disponibilidad.",
  },
  admin: { label: "Reserva revocada por el estudiante" },
};

/** Fee con comprobante ya cargado, esperando validación de EstuRed (`estured_fee_payments.pending_manual_payment`). */
const FEE_PROOF_SENT: Entry = {
  tone: "amber",
  nextAction: "view_fee_status",
  student: {
    label: "Fee en validación",
    helper: "Recibimos tu comprobante del fee. EstuRed lo está validando y te avisamos cuando se confirme tu reserva.",
  },
  residence: {
    label: "Reserva — fee en validación",
    helper: "El estudiante ya envió el comprobante del fee y EstuRed lo está validando.",
  },
  admin: { label: "Reserva — fee en validación" },
};

const UNKNOWN: Entry = {
  tone: "neutral",
  student: { label: "Estado en revisión" },
  residence: { label: "Estado en revisión" },
  admin: { label: "Estado en revisión" },
};

function build(
  key: string,
  entry: Entry,
  viewer: VisibleStatusViewer,
  source: VisibleStatus["source"],
  hasReceipt: boolean,
): VisibleStatus {
  const copy = entry[viewer];
  let nextAction = entry.nextAction ?? null;
  // "Ver comprobante" solo si el comprobante existe.
  if (!nextAction && source === "reservation" && hasReceipt && ["confirmed", "receipt_pending", "receipt_issued"].includes(key)) {
    nextAction = "view_receipt";
  }
  return {
    key,
    label: copy.label,
    tone: entry.tone,
    helper: copy.helper ?? "",
    source,
    studentActionRequired: entry.studentAction ?? false,
    isClosed: entry.closed ?? false,
    nextAction,
  };
}

/**
 * Deriva el estado a mostrar. `reservation` es la reserva asociada a la
 * solicitud (`reservations.application_request_id`), o `null`/`undefined`
 * si no existe. Cuando existe, su estado manda sobre el de la solicitud.
 */
export function getVisibleStatus(input: {
  applicationStatus: string;
  reservation?: ReservationStatusInput | null;
  viewer: VisibleStatusViewer;
}): VisibleStatus {
  const { applicationStatus, reservation, viewer } = input;

  if (reservation) {
    const hasReceipt = reservation.hasReceipt ?? false;
    const isRevocation =
      reservation.status === "cancelled_by_student" && reservation.cancellationReasonCode === "student_revocation_right";
    if (isRevocation) {
      return build("revoked", REVOKED_RESERVATION, viewer, "reservation", hasReceipt);
    }
    if (reservation.status === "pending_estured_fee" && reservation.feePaymentStatus === "pending_manual_payment") {
      return build("pending_manual_payment", FEE_PROOF_SENT, viewer, "reservation", hasReceipt);
    }
    const entry = RESERVATION_STATUS[reservation.status];
    if (entry) return build(reservation.status, entry, viewer, "reservation", hasReceipt);
    // Estado de reserva desconocido: no inventamos un rótulo, caemos al de la solicitud.
  }

  const appEntry = APPLICATION_STATUS[applicationStatus];
  if (appEntry) return build(applicationStatus, appEntry, viewer, "application", false);
  return build("unknown", UNKNOWN, viewer, "application", false);
}

/** `true` si el estudiante tiene que hacer algo ahora (para ordenar/destacar solicitudes). */
export function studentActionRequired(applicationStatus: string, reservation?: ReservationStatusInput | null): boolean {
  return getVisibleStatus({ applicationStatus, reservation, viewer: "student" }).studentActionRequired;
}

/** Solo los códigos de estado que este helper conoce — útil para tests de cobertura. */
export const KNOWN_APPLICATION_STATUSES = Object.keys(APPLICATION_STATUS);
export const KNOWN_RESERVATION_STATUSES = Object.keys(RESERVATION_STATUS);
