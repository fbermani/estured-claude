import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPushCategory, PUSH_CATEGORIES, type PushCategory } from "@/lib/notifications/categories";
import { notificationAreaForRoles } from "@/lib/notifications/links";
import { shouldSendPush } from "@/lib/push/eligibility";
import { buildPushPayload } from "@/lib/push/payload";
import { isPushSendWindowOpen } from "@/lib/push/schedule";

/**
 * Envío de push web (DR61). Nunca lanza: un push que falla no tumba la acción de negocio que generó el aviso
 * (mismo criterio que `createAuditLog` y `createNotification`). Si faltan las claves VAPID el push se degrada a solo in-app.
 */

type Row = { id: string; user_id: string; category: string };

let vapidReady: boolean | null = null;

export function isPushConfigured(): boolean {
  if (vapidReady !== null) return vapidReady;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  } catch (error) {
    console.error("[push] claves VAPID inválidas:", error instanceof Error ? error.message : error);
    vapidReady = false;
  }
  return vapidReady;
}

type PushStatus = "queued" | "sending" | "sent" | "skipped" | "failed";

async function setStatus(admin: SupabaseClient, id: string, status: PushStatus) {
  const { error } = await admin.from("notifications").update({ push_status: status }).eq("id", id);
  if (error) console.error("[push] no se pudo marcar push_status:", error.code, error.message);
}

async function loadRecipient(admin: SupabaseClient, userId: string) {
  const [{ data: roleRows }, { data: prefRows }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId),
    admin.from("push_preferences").select("category, enabled").eq("user_id", userId),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role as string);
  const preferences: Partial<Record<PushCategory, boolean>> = {};
  for (const row of prefRows ?? []) {
    if (isPushCategory(row.category)) preferences[row.category] = row.enabled as boolean;
  }
  return { roles, isAdmin: roles.includes("admin") || roles.includes("superadmin"), preferences };
}

/** Manda el push ya, sin mirar la ventana horaria. Marca `sent`, `skipped` o `failed` en la notificación. */
async function sendNow(admin: SupabaseClient, row: Row): Promise<"sent" | "skipped" | "failed"> {
  const category = row.category as PushCategory;
  const recipient = await loadRecipient(admin, row.user_id);
  if (!shouldSendPush({ category, isAdmin: recipient.isAdmin, preferences: recipient.preferences })) {
    await setStatus(admin, row.id, "skipped");
    return "skipped";
  }
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", row.user_id)
    .is("revoked_at", null);
  if (!subs || subs.length === 0) {
    await setStatus(admin, row.id, "skipped");
    return "skipped";
  }
  // El contador se calcula al enviar (no al encolar): es el mismo número que la campana.
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", row.user_id)
    .is("read_at", null);
  const payload = JSON.stringify(
    buildPushPayload({ category, area: notificationAreaForRoles(recipient.roles), unreadCount: count ?? 1 }),
  );

  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload,
        { TTL: 60 * 60 * 24, urgency: "normal", timeout: 8000 },
      );
      delivered += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // Suscripción vencida o desinstalada: se revoca y no se reintenta.
        await admin.from("push_subscriptions").update({ revoked_at: new Date().toISOString() }).eq("id", sub.id);
      } else {
        console.error("[push] envío falló:", status ?? "sin código");
      }
    }
  }
  const finalStatus = delivered > 0 ? "sent" : "failed";
  await setStatus(admin, row.id, finalStatus);
  return finalStatus;
}

/**
 * Punto de entrada desde `createNotification`: decide enviar ya, encolar hasta las 9:00 (Argentina) u omitir.
 * No lanza.
 */
export async function dispatchNotificationPush(admin: SupabaseClient, row: Row, now: Date = new Date()): Promise<void> {
  try {
    if (!isPushCategory(row.category) || !isPushConfigured()) return;
    if (!isPushSendWindowOpen(now)) {
      await setStatus(admin, row.id, "queued");
      return;
    }
    await sendNow(admin, row);
  } catch (error) {
    console.error("[push] dispatch failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Cron horario: envía lo encolado desde las 9:00 (Argentina). Si el aviso ya se leyó, se omite.
 * Acota el lote para no pasarse del tiempo de la función.
 */
export async function flushQueuedPush(
  admin: SupabaseClient,
  now: Date = new Date(),
  limit = 200,
): Promise<{ sent: number; skipped: number }> {
  const result = { sent: 0, skipped: 0 };
  try {
    if (!isPushConfigured() || !isPushSendWindowOpen(now)) return result;
    const { data, error } = await admin
      .from("notifications")
      .select("id, user_id, category, read_at")
      .eq("push_status", "queued")
      .in("category", [...PUSH_CATEGORIES])
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) {
      // Migración 0101 sin aplicar: degradación silenciosa.
      if (error.code !== "42703" && error.code !== "42P01") console.error("[push] flush query failed:", error.code, error.message);
      return result;
    }
    for (const row of data ?? []) {
      if (row.read_at) {
        await setStatus(admin, row.id as string, "skipped");
        result.skipped += 1;
        continue;
      }
      // Cierre atómico: si otra corrida ya lo tomó, esta no lo manda de nuevo.
      const { data: claimed } = await admin
        .from("notifications")
        .update({ push_status: "sending" })
        .eq("id", row.id as string)
        .eq("push_status", "queued")
        .select("id");
      if (!claimed || claimed.length === 0) continue;
      const outcome = await sendNow(admin, row as Row);
      if (outcome === "sent") result.sent += 1;
      else result.skipped += 1;
    }
  } catch (error) {
    console.error("[push] flush failed:", error instanceof Error ? error.message : error);
  }
  return result;
}
