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
export const RESIDENCE_SCOPED_ENTITY_TYPES = ["support_cases", "application_requests", "residence_faq_questions"] as const;

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
  payment_settings: "/admin/payment-settings",
  waitlist_entries: "/admin/waitlists",
  resident_stays: "/admin/community",
};

export function notificationHref(
  input: { entityType: string | null; entityId: string | null; area: NotificationArea },
  context: NotificationLinkContext = {},
): string | null {
  const { entityType, entityId, area } = input;
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
      case "resident_stays":
        return "/students/residency";
      case "waitlist_entries":
        return "/students/waitlist";
      case "support_cases":
        return "/students/support";
      case "renewal_offers":
        return id ? `/students/renewals/${id}` : "/students/renewals";
      case "renewal_requests":
        return "/students/renewals";
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
