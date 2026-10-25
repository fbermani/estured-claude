/**
 * Frases legibles para los eventos de auditoría (auditoría 2026-10-20, H25).
 *
 * `audit_logs.action` guarda claves técnicas (`user_blocked`,
 * `family_proposal_expired`). En el dashboard del admin se muestran como
 * "<actor> <frase>", así que cada frase está en tercera persona y sin jerga
 * técnica. Las claves que no están en el mapa NO se muestran crudas: caen en
 * una frase genérica. El log del admin muestra el código técnico solo como
 * tooltip, y un test de cobertura exige una frase para cada acción del código.
 */
const ACTION_PHRASES: Record<string, string> = {
  // Altas y perfiles
  student_registered: "se registró como estudiante",
  residence_registered: "registró una residencia",
  family_registered_and_link_requested: "se registró como familiar y pidió vincularse",
  student_profile_updated: "actualizó su perfil",
  student_document_uploaded: "subió un documento de estudiante",
  user_logged_out: "cerró sesión",
  admin_user_created: "creó un usuario admin",
  demo_user_seeded: "sembró un usuario demo",
  user_blocked: "bloqueó a un usuario",
  user_unblocked: "desbloqueó a un usuario",
  // Residencias y verificación
  residence_profile_submitted: "envió una residencia para revisión",
  residence_profile_saved_draft: "guardó cambios en una residencia",
  residence_verification_approved: "aprobó y publicó una residencia",
  residence_verification_rejected: "rechazó una residencia",
  residence_verification_needs_changes: "pidió cambios en una residencia",
  residence_verification_scheduled: "programó la visita de verificación de una residencia",
  residence_verification_expiry_warned: "avisó que vence pronto la verificación de una residencia (30 días)",
  residence_verification_expired: "venció la verificación anual de una residencia",
  residence_profile_edit_approved: "aprobó una edición de perfil",
  residence_profile_edit_rejected: "rechazó una edición de perfil",
  residence_profile_edit_correction_requested: "pidió corrección en una edición de perfil",
  residence_paused_by_admin: "pausó una residencia",
  residence_reactivated_by_admin: "reactivó una residencia",
  residence_internal_note_added: "agregó una nota interna a una residencia",
  residence_visibility_warning_issued: "emitió una advertencia de calidad",
  residence_visibility_reduced: "redujo la visibilidad de una residencia",
  residence_visibility_restored: "restauró la visibilidad normal de una residencia",
  tariff_change_reviewed: "revisó un cambio de tarifa",
  document_accessed: "accedió a un documento sensible",
  operational_access_granted: "otorgó acceso a Gestión Operativa",
  operational_access_revoked: "revocó acceso a Gestión Operativa",
  operational_access_expired: "venció un acceso a Gestión Operativa",
  // Disponibilidad y habitaciones
  availability_updated: "actualizó la disponibilidad de una residencia",
  availability_marked_not_updated: "marcó una disponibilidad como sin actualizar",
  availability_hidden_from_search: "ocultó de las búsquedas una disponibilidad vencida",
  room_renamed: "renombró una habitación",
  bed_marked_out_of_service: "dejó una cama fuera de servicio",
  bed_reactivated: "reactivó una cama",
  // Solicitudes y negociación
  application_request_submitted: "envió una solicitud de reserva",
  application_request_queued: "dejó una solicitud en cola",
  application_promoted_from_queue: "pasó una solicitud de la cola a nuevas",
  application_contact_established: "estableció contacto con un estudiante",
  application_rejected: "rechazó una solicitud",
  application_expired_no_residence_response: "venció una solicitud sin respuesta de la residencia",
  application_expired_no_student_payment: "venció una solicitud sin pago a la residencia",
  application_reactivated_after_pause: "reactivó una solicitud que estaba pausada",
  application_reopened_by_admin: "reabrió una solicitud",
  residence_payment_enabled_without_negotiation: "habilitó el pago a la residencia sin cambios",
  negotiation_proposal_sent: "envió una propuesta de ajuste",
  negotiation_proposal_expired: "venció una propuesta de ajuste",
  negotiation_accepted: "aceptó una propuesta de ajuste",
  negotiation_rejected: "rechazó una propuesta de ajuste",
  family_proposal_created: "creó una propuesta de familiar",
  family_proposal_approved: "aprobó una propuesta de familiar",
  family_proposal_rejected: "rechazó una propuesta de familiar",
  family_proposal_expired: "venció una propuesta de familiar",
  family_invitation_sent: "invitó a un familiar",
  family_link_approved: "aprobó un vínculo familiar",
  family_link_rejected: "rechazó un vínculo familiar",
  family_link_revoked: "revocó un vínculo familiar",
  family_profile_updated: "actualizó su perfil de familiar",
  estured_fee_payer_changed: "cambió quién paga el fee EstuRed",
  favorite_added: "guardó una residencia en favoritos",
  favorite_removed: "quitó una residencia de favoritos",
  // Pagos, fee, reserva y comprobantes
  residence_payment_proof_uploaded: "subió un comprobante de pago a la residencia",
  residence_payment_marked_received: "marcó el pago a la residencia como recibido",
  estured_fee_manual_payment_registered: "registró un comprobante del fee EstuRed",
  estured_fee_marked_paid_manually: "marcó un fee EstuRed como cobrado",
  estured_fee_expired: "venció el plazo de un fee EstuRed",
  estured_fee_revoked: "revocó un fee EstuRed",
  estured_fee_refunded_after_revocation: "reintegró un fee EstuRed tras una revocación",
  estured_fee_revocation_denied: "denegó la revocación de un fee EstuRed",
  estured_fee_window_reopened_by_admin: "reabrió el plazo de un fee EstuRed",
  reservation_confirmed: "confirmó una reserva",
  booking_receipt_reissued: "volvió a emitir un comprobante de reserva",
  booking_receipt_generation_failed: "no pudo generar un comprobante de reserva",
  exchange_rate_force_refresh: "actualizó el tipo de cambio",
  exchange_rate_override_set: "fijó un tipo de cambio manual",
  exchange_rate_override_removed: "quitó el tipo de cambio manual",
  // Cambios de estadía ("Quiero cambiar", DR3) y salidas anticipadas
  stay_change_intent_created: "avisó que quiere cambiar de residencia o plaza",
  stay_change_intent_updated: "actualizó un aviso de cambio de residencia",
  stay_change_intent_cancelled: "canceló un aviso de cambio de residencia",
  stay_change_intent_extended: "extendió un aviso de cambio de residencia",
  stay_change_intent_expired: "venció un aviso de cambio de residencia",
  stay_change_intent_expired_stay_ended: "cerró un aviso de cambio porque terminó la estadía",
  stay_change_intent_keep_alive_notified: "pidió confirmar que sigue vigente un aviso de cambio",
  stay_change_intent_confirmed_by_family: "confirmó, como familiar, un aviso de cambio",
  stay_change_intent_resolved: "resolvió un aviso de cambio de residencia",
  stay_change_response_sent: "respondió a un aviso de cambio",
  stay_change_response_edited: "editó su respuesta a un aviso de cambio",
  application_cancelled_stay_change: "canceló una solicitud por un cambio de residencia",
  waitlist_entry_removed_stay_change: "quitó a alguien de una lista de espera por un cambio de residencia",
  resident_stay_early_exit_recorded: "registró una salida anticipada de un residente",
  stay_early_exit_student_note_saved: "guardó la nota de una salida anticipada",
  residence_early_exit_policy_updated: "actualizó la política de salida anticipada de una residencia",
  residence_age_range_updated: "actualizó la edad de los residentes de una residencia",
  // Cuenta, cobros y configuración
  password_reset_completed: "restableció su contraseña",
  password_reset_denied: "rechazó un intento de restablecer la contraseña",
  payment_settings_updated: "actualizó los datos de cobro",
  student_visibility_updated: "cambió su visibilidad en la comunidad",
  residence_location_updated: "actualizó la ubicación de una residencia",
  residence_profile_resubmitted: "reenvió a revisión una residencia tras pedido de cambios",
  residence_faq_hidden: "ocultó una pregunta de su ficha",
  residence_faq_hidden_by_admin: "ocultó una pregunta de una ficha",
  residence_faq_restored: "volvió a mostrar una pregunta de su ficha",
  residence_faq_restored_by_admin: "volvió a mostrar una pregunta de una ficha",
  residence_faq_answered: "respondió una pregunta de la ficha",
  residence_faq_answer_edited: "editó la respuesta a una pregunta de la ficha",
  residence_regulation_published: "publicó una versión del reglamento",
  application_regulation_accepted: "aceptó el reglamento al enviar la solicitud",
  application_regulation_acceptance_failed: "no pudo registrar la aceptación del reglamento de una solicitud",
  residence_faq_catalog_item_saved: "actualizó una pregunta frecuente del catálogo en su ficha",
  // Dinero: confirmación de reserva (DR8)
  reservation_confirmation_failed_after_fee_paid: "no pudo confirmar una reserva con el fee ya cobrado",
  reservation_confirmation_retried: "reintentó la confirmación de una reserva",
  negotiation_rejected_chose_original: "rechazó una propuesta de ajuste y eligió las condiciones originales",
  negotiation_rejected_closed: "rechazó una propuesta de ajuste y cerró la solicitud",
  // Renovaciones
  renewal_request_created: "pidió una renovación",
  renewal_request_closed_no_offer: "cerró un pedido de renovación sin oferta",
  renewal_request_reopened_by_admin: "reabrió un pedido de renovación",
  renewal_offer_sent: "envió una oferta de renovación",
  renewal_offer_draft_saved: "guardó un borrador de oferta de renovación",
  renewal_offer_expired: "venció una oferta de renovación",
  renewal_offer_reopened_by_admin: "reabrió una oferta de renovación",
  renewal_offer_accepted_by_student: "aceptó una oferta de renovación",
  renewal_offer_rejected_by_student: "rechazó una oferta de renovación",
  renewal_residence_payment_marked_received: "marcó el pago de una renovación como recibido",
  renewal_fee_manual_payment_registered: "registró un comprobante del fee de una renovación",
  renewal_fee_marked_paid_manually: "marcó el fee de una renovación como cobrado",
  renewal_confirmed: "confirmó una renovación",
  renewal_receipt_generation_failed: "no pudo generar un comprobante de renovación",
  // Residentes
  resident_stay_created: "cargó un residente",
  resident_stay_activated: "activó un residente",
  resident_stay_bed_assigned: "asignó una cama a un residente",
  resident_stay_details_updated: "actualizó los datos de un residente",
  resident_stay_ended: "registró la salida de un residente",
  resident_stay_hidden: "ocultó a un residente de la comunidad",
  resident_stay_shown: "volvió a mostrar a un residente en la comunidad",
  resident_note_added: "agregó una nota a un residente",
  resident_marked_inactive_by_admin: "marcó un residente como inactivo",
  resident_visibility_limited_by_admin: "limitó la visibilidad de un residente",
  resident_visibility_restored_by_admin: "restauró la visibilidad de un residente",
  // Equipo de la residencia (DR10)
  team_invitation_sent: "invitó a una persona al equipo de una residencia",
  team_invitation_resent: "reenvió una invitación al equipo de una residencia",
  team_invitation_cancelled: "canceló una invitación al equipo de una residencia",
  team_invitation_accepted: "aceptó una invitación al equipo de una residencia",
  team_member_removed: "quitó el acceso a una persona del equipo de una residencia",
  team_permissions_changed: "cambió los permisos de una persona del equipo de una residencia",
  // Lista de espera y soporte
  waitlist_entry_joined: "se sumó a una lista de espera",
  waitlist_entry_left: "salió de una lista de espera",
  waitlist_entry_activated: "activó un lugar en la lista de espera",
  waitlist_entry_stayed: "confirmó que sigue en la lista de espera",
  waitlist_availability_notified: "avisó a la lista de espera que hay lugar",
  waitlist_keep_alive_notified: "pidió confirmar que sigue en la lista de espera",
  waitlist_entry_removed_by_admin: "quitó a alguien de una lista de espera",
  waitlist_entry_removed_by_residence: "quitó a alguien de su lista de espera",
  waitlist_entry_removed_confirmed_reservation: "cerró una lista de espera por reserva confirmada",
  support_case_opened: "abrió un caso de Soporte",
  support_case_status_updated: "actualizó un caso de Soporte",
};

const ACTOR_LABELS: Record<string, string> = {
  admin: "Admin",
  superadmin: "Admin",
  residence_owner: "Residencia",
  residence_staff: "Residencia",
  student: "Estudiante",
  family_member: "Familiar",
  registered_user: "Usuario",
  system: "Sistema",
};

/** Frase del evento sin el actor. Una clave desconocida nunca se muestra cruda. */
export function auditActionPhrase(action: string): string {
  return ACTION_PHRASES[action] ?? "registró una actividad";
}

export function auditActorLabel(actorRole: string): string {
  return ACTOR_LABELS[actorRole] ?? "Usuario";
}

const SOURCE_LABELS: Record<string, string> = {
  user: "Usuario",
  admin: "Admin",
  system: "Sistema",
  payment_provider: "Medio de pago",
};

export function auditSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? "Sistema";
}

/** ¿Hay etiqueta humana para esta acción? (lo usa el test de cobertura y el filtro del log). */
export function hasAuditActionLabel(action: string): boolean {
  return action in ACTION_PHRASES;
}

/** Acciones con etiqueta, ordenadas por frase: opciones del filtro del log. */
export function auditActionOptions(): { value: string; label: string }[] {
  return Object.entries(ACTION_PHRASES)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

const ENTITY_LABELS: Record<string, string> = {
  application_requests: "Solicitud",
  beds: "Cama",
  booking_receipts: "Comprobante de reserva",
  estured_fee_payments: "Pago del fee EstuRed",
  exchange_rates: "Tipo de cambio",
  family_application_proposals: "Propuesta de familiar",
  family_invitations: "Invitación de familiar",
  family_links: "Vínculo familiar",
  family_members: "Perfil de familiar",
  fee_revocations: "Revocación del fee",
  files: "Archivo",
  payment_settings: "Datos de cobro",
  profile_availability: "Disponibilidad",
  renewal_offers: "Oferta de renovación",
  renewal_requests: "Pedido de renovación",
  reservations: "Reserva",
  residence_faq_questions: "Pregunta de ficha",
  residence_faq_items: "Pregunta frecuente del catálogo",
  residence_team_invitations: "Invitación al equipo",
  residence_users: "Miembro del equipo",
  residences: "Residencia",
  resident_notes: "Nota de residente",
  resident_stays: "Residente",
  rooms: "Habitación",
  stay_change_intents: "Aviso de cambio",
  stay_early_exits: "Salida anticipada",
  student_favorites: "Favorito",
  student_profiles: "Perfil de estudiante",
  student_visibility_settings: "Visibilidad de estudiante",
  support_cases: "Caso de Soporte",
  users: "Usuario",
  waitlist_entries: "Lista de espera",
};

/** Tipo de entidad en español; un tipo desconocido cae en "Otro" (nunca el nombre de tabla crudo). */
export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? "Otro";
}

/** Tipos de entidad con etiqueta: opciones del filtro del log. */
export function auditEntityOptions(): { value: string; label: string }[] {
  return Object.entries(ENTITY_LABELS)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
