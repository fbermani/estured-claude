/* EstuRed — service worker (DR61). Solo push, clic en la notificación y contador del ícono. Sin caché offline. */

/** Solo rutas del propio sitio: se resuelve contra el origen y se descarta todo lo que salga de él. */
function safePath(raw) {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  try {
    const url = new URL(raw, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "EstuRed";
  const url = safePath(data.url);
  event.waitUntil(
    (async () => {
      // Chrome e iOS exigen mostrar una notificación en cada push (sin pushes silenciosos).
      await self.registration.showNotification(title, {
        body: typeof data.body === "string" ? data.body : "",
        tag: typeof data.tag === "string" ? data.tag : "estured",
        renotify: true,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url },
      });
      try {
        const count = Number.isInteger(data.badge) ? data.badge : 0;
        if (count > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(count);
        else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
      } catch {
        /* La Badging API no existe en todos los navegadores. */
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          try {
            if ("navigate" in client) await client.navigate(target);
            return;
          } catch {
            break; // pestaña no controlada: se abre una ventana nueva
          }
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
