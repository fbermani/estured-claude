/**
 * Categorías de aviso (DR61). `none` = solo in-app. Las demás pueden disparar push web.
 * Módulo puro (sin server-only): lo usan el servidor, los tests y la pantalla de preferencias.
 */
export const PUSH_CATEGORIES = [
  "requests_reservations",
  "payments_fee",
  "deadlines",
  "admin_requests",
  "admin_signups",
] as const;

export type PushCategory = (typeof PUSH_CATEGORIES)[number];
export type NotificationCategory = "none" | PushCategory;

/** Categorías que solo ven (y reciben) usuarios con rol admin o superadmin. */
export const ADMIN_PUSH_CATEGORIES: readonly PushCategory[] = ["admin_requests", "admin_signups"];

export function isPushCategory(value: unknown): value is PushCategory {
  return typeof value === "string" && (PUSH_CATEGORIES as readonly string[]).includes(value);
}

export function isAdminPushCategory(category: PushCategory): boolean {
  return ADMIN_PUSH_CATEGORIES.includes(category);
}

/** Etiquetas de la pantalla de preferencias (copy de interfaz, voseo). */
export const PUSH_CATEGORY_LABELS: Record<PushCategory, { label: string; hint: string }> = {
  requests_reservations: { label: "Solicitudes y reservas", hint: "Cuando algo cambia en una solicitud o en una reserva." },
  payments_fee: { label: "Pagos y fee", hint: "Cuando hay un pago o un fee por revisar." },
  deadlines: { label: "Plazos y vencimientos", hint: "Cuando un plazo está por vencer o venció." },
  admin_requests: { label: "Administración", hint: "Verificaciones, Soporte, revocaciones y pagos por revisar." },
  admin_signups: { label: "Registros nuevos", hint: "Cuando se registra un estudiante o una residencia." },
};
