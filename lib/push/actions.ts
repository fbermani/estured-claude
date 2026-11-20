"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import {
  isAdminPushCategory,
  isPushCategory,
  PUSH_CATEGORIES,
  type PushCategory,
} from "@/lib/notifications/categories";
import { isAllowedPushEndpoint, isValidPushKey } from "@/lib/push/endpoint";
import { isPushConfigured } from "@/lib/push/dispatch";

/**
 * Server actions de push web (DR61, docs/07 §29.1). Ninguna confía en un `user_id` del cliente: todo se hace
 * con el id de la sesión. Mensajes en español, sin jerga.
 */

const MAX_ACTIVE_SUBSCRIPTIONS = 10;
const GENERIC_ERROR = "No pudimos activar los avisos. Probá de nuevo en un rato.";

export type PushActionResult = { ok: true } | { ok: false; error: string };

export type PushState = {
  available: boolean;
  /** Este dispositivo (por endpoint) tiene una suscripción activa. */
  subscribed: boolean;
  activeDevices: number;
  /** Solo categorías que este usuario puede ver, con su interruptor (sin fila = activado). */
  categories: { category: PushCategory; enabled: boolean }[];
};

function userAgentOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 300) : null;
}

export async function subscribePush(input: {
  endpoint: unknown;
  p256dh: unknown;
  auth: unknown;
  userAgent?: unknown;
}): Promise<PushActionResult> {
  const user = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return { ok: false, error: "Iniciá sesión para activar los avisos." };
  if (!isPushConfigured()) return { ok: false, error: "Los avisos todavía no están disponibles." };
  if (!isAllowedPushEndpoint(input.endpoint) || !isValidPushKey(input.p256dh) || !isValidPushKey(input.auth, 64)) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const limit = await consumeRateLimit({ bucket: "push_subscribe", key: user.id, windowSeconds: 3600, max: 20 });
  if (!limit.ok) return { ok: false, error: "Hiciste muchos intentos. Probá de nuevo en una hora." };

  const { data: existing } = await admin
    .from("push_subscriptions")
    .select("id, user_id, revoked_at, p256dh, auth")
    .eq("endpoint", input.endpoint)
    .maybeSingle();

  // Un endpoint ajeno solo se reasigna si quien lo pide demuestra que es ese dispositivo (mismas claves): si no, cualquiera que
  // conozca el endpoint de otra persona le cortaría los avisos. «Mismo dispositivo, otra cuenta» sigue andando: el navegador
  // devuelve las mismas claves.
  if (existing && existing.user_id !== user.id && (existing.p256dh !== input.p256dh || existing.auth !== input.auth)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // El tope cuenta las suscripciones activas también al reactivar o reasignar una fila (si no, se saltea revocando e insertando).
  const needsSlot = !existing || existing.revoked_at !== null || existing.user_id !== user.id;
  if (needsSlot) {
    const { count } = await admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null);
    if ((count ?? 0) >= MAX_ACTIVE_SUBSCRIPTIONS) {
      return { ok: false, error: "Ya tenés 10 dispositivos con avisos. Desactivá alguno para sumar este." };
    }
  }

  const now = new Date().toISOString();
  if (existing) {
    const { error } = await admin
      .from("push_subscriptions")
      .update({
        user_id: user.id,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: userAgentOf(input.userAgent),
        revoked_at: null,
        last_seen_at: now,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[push] subscribe update failed:", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: true };
  }

  const { error } = await admin.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: userAgentOf(input.userAgent),
  });
  if (error) {
    console.error("[push] subscribe insert failed:", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}

/** Revoca SOLO una suscripción del usuario logueado: un endpoint ajeno no coincide con el filtro por `user_id`. */
export async function unsubscribePush(endpoint: unknown): Promise<PushActionResult> {
  const user = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return { ok: false, error: "Iniciá sesión para cambiar los avisos." };
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) return { ok: false, error: GENERIC_ERROR };
  const { error } = await admin
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .is("revoked_at", null);
  if (error) {
    console.error("[push] unsubscribe failed:", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}

export async function setPushPreference(category: unknown, enabled: unknown): Promise<PushActionResult> {
  const user = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return { ok: false, error: "Iniciá sesión para cambiar los avisos." };
  if (!isPushCategory(category) || typeof enabled !== "boolean") return { ok: false, error: GENERIC_ERROR };
  const isAdmin = user.roles.includes("admin") || user.roles.includes("superadmin");
  if (isAdminPushCategory(category) && !isAdmin) return { ok: false, error: GENERIC_ERROR };
  const { error } = await admin
    .from("push_preferences")
    .upsert({ user_id: user.id, category, enabled, updated_at: new Date().toISOString() }, { onConflict: "user_id,category" });
  if (error) {
    console.error("[push] preference failed:", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}

export async function getPushState(currentEndpoint?: unknown): Promise<PushState> {
  const empty: PushState = { available: false, subscribed: false, activeDevices: 0, categories: [] };
  const user = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!user || !admin || !isPushConfigured()) return empty;
  const isAdmin = user.roles.includes("admin") || user.roles.includes("superadmin");
  const [{ data: subs }, { data: prefs }] = await Promise.all([
    admin.from("push_subscriptions").select("endpoint").eq("user_id", user.id).is("revoked_at", null),
    admin.from("push_preferences").select("category, enabled").eq("user_id", user.id),
  ]);
  const enabledBy = new Map((prefs ?? []).map((p) => [p.category as string, p.enabled as boolean]));
  return {
    available: true,
    subscribed: typeof currentEndpoint === "string" && (subs ?? []).some((s) => s.endpoint === currentEndpoint),
    activeDevices: subs?.length ?? 0,
    categories: PUSH_CATEGORIES.filter((c) => isAdmin || !isAdminPushCategory(c)).map((category) => ({
      category,
      enabled: enabledBy.get(category) !== false,
    })),
  };
}
