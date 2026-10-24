/**
 * Destino de cada notificación in-app (auditoría 2026-10-20, H20).
 *
 * La tabla `notifications` (migración 0021) ya guarda `related_entity_type` y
 * `related_entity_id`, así que NO hace falta una columna de enlace: el destino
 * se deriva acá, según el tipo de entidad y el área del usuario que la recibe.
 * Es presentación pura: no consulta nada ni abre acceso a nada (las pantallas
 * destino validan permisos por su cuenta). Si no hay una pantalla razonable, devuelve
 * `null` y la notificación se muestra sin enlace — nunca un enlace inventado.
 */

export type NotificationArea = "student" | "residence" | "admin";

/** Datos que hay que leer de la base para resolver algunos destinos (ver `resolveNotificationContext`). */
export type NotificationLinkContext = {
  /** reservation_id → application_request_id (la pantalla del estudiante cuelga de la solicitud). */
  applicationIdByReservationId?: Record<string, string>;
  /** `${tipo}:${id}` → residence_id, para las pantallas `/residence/[residence_id]/...`. */
  residenceIdByEntity?: Record<string, string>;
  /** faq_question_id → slug de la residencia, para llevar al visitante a la ficha donde le respondieron. */
  residenceSlugByFaqQuestionId?: Record<string, string>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tipos de entidad que, para el área residencia, necesitan saber de qué residencia son. */
export const RESIDENCE_SCOPED_ENTITY_TYPES = ["support_cases", "application_requests", "residence_faq_questions", "stay_change_intents", "waitlist_entries", "renewal_requests"] as const;

/** Columna que dice de qué residencia es cada tipo de entidad (por defecto `residence_id`). */
export const RESIDENCE_COLUMN_BY_ENTITY: Record<string, string> = { stay_change_intents: "current_residence_id" };

const ADMIN_LIST: Record<string, string> = {
  application_requests: "/admin/applications",
  reservations: "/admin/reservations",
  residences: "/admin/residences",
  support_cases: "/admin/support-cases",
  renewal_offers: "/admin/renewals",
  renewal_requests: "/admin/renewals",
  booking_receipts: "/admin/receipts",
  renewal_receipts: "/admin/receipts",
  estured_fee_payments: "/admin/payments",
  fee_revocations: "/admin/activity?tab=revocations",
  payment_settings: "/admin/payment-settings",
  waitlist_entries: "/admin/waitlists",
  resident_stays: "/admin/community",
};

export function notificationHref(
  input: { entityType: string | null; entityId: string | null; area: NotificationArea; isFamily?: boolean },
  context: NotificationLinkContext = {},
): string | null {
  const { entityType, entityId, area, isFamily } = input;
  if (!entityType) return null;
  // Defensa: nunca armar una ruta con un id que no sea un UUID.
  const id = entityId && UUID_RE.test(entityId) ? entityId : null;

  if (area === "admin") return ADMIN_LIST[entityType] ?? null;

  if (area === "student") {
    switch (entityType) {
      case "application_requests":
        return id ? `/students/applications/${id}` : "/students/applications";
      case "reservations": {
        const applicationId = id ? context.applicationIdByReservationId?.[id] : undefined;
        return applicationId ? `/students/applications/${applicationId}` : "/students/applications";
      }
      case "fee_revocations":
        // DR6: resolución de la revocación del fee (el id es el de la reserva); la pantalla muestra el estado.
        return "/students/revocation";
      case "resident_stays":
        return "/students/residency";
      case "waitlist_entries":
        return "/students/waitlist";
      case "student_favorites":
        // Ciclo 58: aviso de listas de espera anuladas al confirmar una reserva; el id es opcional.
        return "/students/favorites";
      case "support_cases":
        return "/students/support";
      case "renewal_offers":
        return id ? `/students/renewals/${id}` : "/students/renewals";
      case "renewal_requests":
        return "/students/renewals";
      case "stay_early_exits":
        return "/students/residency";
      case "stay_change_intents":
        // DR3 "Quiero cambiar": el bloque vive en Mi residencia (el familiar lo ve en solo lectura en la misma ruta).
        return "/students/residency#quiero-cambiar";
      case "family_application_proposals":
        // DR4: el estudiante responde en su pantalla de propuestas; el familiar ve el estado en su inicio.
        return isFamily ? "/students/dashboard" : "/students/family-proposals";
      case "residence_faq_questions": {
        const slug = id ? context.residenceSlugByFaqQuestionId?.[id] : undefined;
        return slug ? `/residencias/${encodeURIComponent(slug)}#preguntas` : null;
      }
      default:
        return null;
    }
  }

  // area === "residence"
  switch (entityType) {
    case "residences":
      return id ? `/residence/${id}` : "/residence/dashboard";
    case "support_cases": {
      const residenceId = id ? context.residenceIdByEntity?.[`support_cases:${id}`] : undefined;
      return residenceId ? `/residence/${residenceId}/support` : null;
    }
    case "application_requests": {
      const residenceId = id ? context.residenceIdByEntity?.[`application_requests:${id}`] : undefined;
      return residenceId && id ? `/residence/${residenceId}/applications/${id}` : null;
    }
    case "residence_faq_questions": {
      const residenceId = id ? context.residenceIdByEntity?.[`residence_faq_questions:${id}`] : undefined;
      return residenceId ? `/residence/${residenceId}/faq` : null;
    }
    case "waitlist_entries": {
      const residenceId = id ? context.residenceIdByEntity?.[`waitlist_entries:${id}`] : undefined;
      return residenceId ? `/residence/${residenceId}/waitlist` : null;
    }
    case "renewal_requests": {
      const residenceId = id ? context.residenceIdByEntity?.[`renewal_requests:${id}`] : undefined;
      return residenceId ? `/residence/${residenceId}/renewals` : null;
    }
    case "stay_change_intents": {
      const residenceId = id ? context.residenceIdByEntity?.[`stay_change_intents:${id}`] : undefined;
      return residenceId ? `/residence/${residenceId}/residents?filtro=buscan-cambiar` : null;
    }
    default:
      return null;
  }
}

/** Área de la app a la que pertenece el usuario según sus roles (admin > residencia > estudiante/familiar). */
export function notificationAreaForRoles(roles: string[]): NotificationArea {
  if (roles.includes("admin") || roles.includes("superadmin")) return "admin";
  if (roles.includes("residence_owner") || roles.includes("residence_staff")) return "residence";
  return "student";
}
