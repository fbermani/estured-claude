/**
 * Meta Pixel (Paso 0 del runbook, «Medición»). Inerte por defecto: solo se carga con `NEXT_PUBLIC_META_PIXEL_ID` válido Y en
 * producción real de Vercel (`VERCEL_ENV === "production"`); nunca en desarrollo ni en el staging/Preview. Sin datos personales:
 * no hay coincidencia avanzada y los eventos solo llevan un nombre de pantalla fijo. Sin `server-only`: lo usan cliente y tests.
 */

export type MetaPixelEvent = "PageView" | "CompleteRegistration" | "Lead";

type Env = Record<string, string | undefined>;

/** ID del pixel o null. Decide en el servidor (el layout lo pasa por prop). Solo dígitos: evita inyectar nada en el script. */
export function resolveMetaPixelId(env: Env): string | null {
  const id = (env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
  if (!/^\d{5,20}$/.test(id)) return null;
  if (env.VERCEL_ENV !== "production") return null;
  return id;
}

type FbqFn = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: unknown; disablePushState?: boolean; allowDuplicatePageViews?: boolean };
type PixelWindow = { fbq?: FbqFn; _fbq?: FbqFn; location?: { search: string } };
type PixelDocument = {
  createElement: (tag: string) => { async: boolean; src: string };
  getElementsByTagName: (tag: string) => ArrayLike<{ parentNode: { insertBefore: (node: unknown, ref: unknown) => unknown } | null }>;
};

const SCRIPT_URL = "https://connect.facebook.net/en_US/fbevents.js";

/** El link de invitación familiar lleva un token en la dirección y el pixel manda la dirección a Meta: ahí no se carga ni se envía nada. */
function carriesInvitation(win: PixelWindow): boolean {
  return Boolean(win.location?.search.includes("invitacion"));
}

/**
 * Carga el script oficial, apaga la configuración automática y hace `init`. Sin ID devuelve false y no toca el documento.
 * Idempotente: una segunda llamada no vuelve a inyectar. `PageView` NO se dispara acá (lo hace `MetaPixel` en cada navegación).
 */
export function loadMetaPixel(pixelId: string | null, win: PixelWindow = window as unknown as PixelWindow, doc: PixelDocument = document as unknown as PixelDocument): boolean {
  if (!pixelId || carriesInvitation(win)) return false;
  if (win.fbq) return true;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as FbqFn;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;
  // Las pantallas se cuentan a mano, desde `MetaPixel`: el envío automático saltearía la exclusión de invitaciones y de menores.
  fbq.disablePushState = true;
  // Sin esto el script descarta todo `PageView` después del primero y las pantallas sin recarga no se cuentan. Meta no lo
  // documenta: verificado con el script real en estured.com (2026-11-27). Si los públicos por pantalla bajan, revisar acá.
  fbq.allowDuplicatePageViews = true;
  win.fbq = fbq;
  win._fbq = fbq;
  const script = doc.createElement("script");
  script.async = true;
  script.src = SCRIPT_URL;
  const first = doc.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);
  fbq("set", "autoConfig", false, pixelId); // antes del init: sin esto el pixel manda clics en botones y datos de la página
  fbq("init", pixelId);
  return true;
}

/** Igual que `loadMetaPixel`, pero no hace nada (ni toca el documento) hasta que la persona aceptó las cookies de medición. */
export function loadMetaPixelWithConsent(
  pixelId: string | null,
  consent: "granted" | "denied" | null,
  win?: PixelWindow,
  doc?: PixelDocument,
): boolean {
  if (consent !== "granted") return false;
  return loadMetaPixel(pixelId, win, doc);
}

/** Dispara un evento estándar. Sin pixel cargado no hace nada. `name` es un rótulo fijo de pantalla, nunca un dato del usuario. */
export function trackMetaEvent(event: MetaPixelEvent, name?: string, win: PixelWindow = typeof window === "undefined" ? {} : (window as unknown as PixelWindow)): void {
  if (!win.fbq || carriesInvitation(win)) return;
  if (name) win.fbq("track", event, { content_name: name });
  else win.fbq("track", event);
}
