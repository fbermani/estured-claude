import type { PushCategory } from "@/lib/notifications/categories";

/**
 * Payload del push (DR61, punto 4). NUNCA lleva el `title` ni el `body` del aviso in-app: el texto es
 * fijo por categoría y no contiene nombres, montos, documentos ni el nombre de la residencia.
 * El detalle se ve al abrir la app (campana).
 */
export type PushPayload = {
  title: string;
  body: string;
  /** Agrupa los push de una misma categoría en una sola notificación del sistema. */
  tag: string;
  /** Pantalla de inicio del área; nunca lleva ids de entidades. */
  url: string;
  /** Avisos sin leer del usuario al enviar (el mismo número de la campana). */
  badge: number;
};

export type PushArea = "student" | "residence" | "admin";

const GENERIC_COPY: Record<PushCategory, { title: string; body: string }> = {
  requests_reservations: {
    title: "Novedades en EstuRed",
    body: "Tenés novedades en una solicitud o en una reserva. Abrí la app para verlas.",
  },
  payments_fee: {
    title: "Novedades en un pago",
    body: "Tenés un pago o un fee para revisar. Abrí la app para ver el detalle.",
  },
  deadlines: {
    title: "Un plazo necesita tu atención",
    body: "Abrí la app para ver cuál.",
  },
  admin_requests: {
    title: "Hay algo para revisar",
    body: "Entrá al panel de administración.",
  },
  admin_signups: {
    title: "Hay un registro nuevo",
    body: "Entrá al panel de administración para verlo.",
  },
};

const AREA_HOME: Record<PushArea, string> = {
  student: "/students/dashboard",
  residence: "/residence/dashboard",
  admin: "/admin/dashboard",
};

export function buildPushPayload(input: { category: PushCategory; area: PushArea; unreadCount: number }): PushPayload {
  const copy = GENERIC_COPY[input.category];
  const unread = Number.isFinite(input.unreadCount) ? Math.max(0, Math.min(99, Math.trunc(input.unreadCount))) : 0;
  return {
    title: copy.title,
    body: copy.body,
    tag: `estured-${input.category}`,
    url: AREA_HOME[input.area],
    badge: unread,
  };
}
