"use client";

import { subscribePush, unsubscribePush } from "@/lib/push/actions";

/** Helpers del navegador para push web (DR61). Todo se degrada sin lanzar: `false`/`null` si el navegador no puede. */

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function currentEndpoint(): Promise<string | null> {
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/** Pide el permiso del navegador (solo tras un clic del usuario) y guarda la suscripción en el servidor. */
export async function enablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pushSupported()) return { ok: false, error: "Este navegador no permite avisos." };
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, error: "Los avisos todavía no están disponibles." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "No activaste los permisos. Podés cambiarlo en los ajustes del navegador." };
  }
  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, error: "No pudimos activar los avisos en este dispositivo." };
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  const json = sub.toJSON();
  return subscribePush({
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    userAgent: navigator.userAgent,
  });
}

export async function disablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return { ok: true };
  const result = await unsubscribePush(sub.endpoint);
  await sub.unsubscribe().catch(() => false);
  return result;
}

/** Contador del ícono de la app instalada (Badging API); sin efecto donde no existe. */
export function syncAppBadge(count: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  } catch {
    /* sin Badging API */
  }
}

