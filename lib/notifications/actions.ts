"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  RESIDENCE_SCOPED_ENTITY_TYPES,
  notificationAreaForRoles,
  notificationHref,
  type NotificationLinkContext,
} from "@/lib/notifications/links";
import { markAllNotificationsReadForUser, markNotificationReadForUser } from "@/lib/notifications/markRead";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** Pantalla a la que lleva (H20), o `null` si no corresponde un enlace. */
  href: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Notificaciones del usuario logueado, siempre filtradas por SU id de sesión
 * (la lectura usa service role, así que el filtro por `user_id` es la barrera).
 * `unreadCount` es el total real de sin leer, no solo el de las 20 que se muestran.
 */
export async function getMyNotifications(): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) return { items: [], unreadCount: 0 };

  const [{ data }, { count }] = await Promise.all([
    admin
      .from("notifications")
      .select("id, title, body, read_at, created_at, related_entity_type, related_entity_id")
      .eq("user_id", sessionUser.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sessionUser.id)
      .is("read_at", null),
  ]);

  const rows = data ?? [];
  const area = notificationAreaForRoles(sessionUser.roles);

  // Algunos destinos necesitan un dato más (qué solicitud es esa reserva, de qué residencia es ese caso).
  const context: NotificationLinkContext = {};
  const idsOfType = (type: string) =>
    [...new Set(rows.filter((r) => r.related_entity_type === type && r.related_entity_id).map((r) => r.related_entity_id as string))].filter(
      (id) => UUID_RE.test(id),
    );

  if (area === "student") {
    const reservationIds = idsOfType("reservations");
    if (reservationIds.length) {
      const { data: reservations } = await admin
        .from("reservations")
        .select("id, application_request_id")
        .in("id", reservationIds);
      context.applicationIdByReservationId = Object.fromEntries(
        (reservations ?? []).map((r) => [r.id as string, r.application_request_id as string]),
      );
    }
  } else if (area === "residence") {
    context.residenceIdByEntity = {};
    for (const type of RESIDENCE_SCOPED_ENTITY_TYPES) {
      const ids = idsOfType(type);
      if (!ids.length) continue;
      const { data: entities } = await admin.from(type).select("id, residence_id").in("id", ids);
      for (const e of entities ?? []) context.residenceIdByEntity[`${type}:${e.id}`] = e.residence_id as string;
    }
  }

  const items: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    readAt: n.read_at,
    href: notificationHref(
      { entityType: n.related_entity_type, entityId: n.related_entity_id, area },
      context,
    ),
  }));
  return { items, unreadCount: count ?? items.filter((n) => !n.readAt).length };
}

/**
 * Marca UNA notificación propia como leída (al abrirla). Solo toca filas del
 * usuario de la sesión: un id ajeno no coincide con el filtro y no hace nada
 * (ver `markNotificationReadForUser`).
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) return;
  await markNotificationReadForUser(admin, sessionUser.id, notificationId);
}

/** "Marcar todo como leído": todas las notificaciones sin leer del usuario de la sesión. */
export async function markNotificationsRead(): Promise<void> {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) return;
  await markAllNotificationsReadForUser(admin, sessionUser.id);
}
