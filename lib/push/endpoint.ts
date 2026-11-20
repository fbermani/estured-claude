/**
 * Validación del `endpoint` de una suscripción push (DR61). El servidor hace POST a esa URL, así que una lista
 * abierta sería un SSRF: solo se aceptan `https` de los proveedores de Web Push conocidos, sin credenciales ni puerto.
 */
const MAX_ENDPOINT_LENGTH = 2048;

const EXACT_HOSTS = new Set([
  "fcm.googleapis.com", // Chrome / Android / Edge
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari / iOS
]);
const HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

export function isAllowedPushEndpoint(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Las claves de la suscripción son base64url; se acota el largo para no guardar basura. */
export function isValidPushKey(value: unknown, maxLength = 256): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= maxLength && /^[A-Za-z0-9_\-=]+$/.test(value);
}
