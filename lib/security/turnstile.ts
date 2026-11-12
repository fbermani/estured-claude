import "server-only";

/**
 * Cloudflare Turnstile verificado en NUESTRAS server actions (no el CAPTCHA nativo de Supabase). El widget
 * (`components/ui/TurnstileWidget.tsx`) agrega el campo `cf-turnstile-response` al formulario; acá se valida contra siteverify.
 *
 * Sin `TURNSTILE_SECRET_KEY`: fuera de producción deja pasar (fail-open, con aviso) y en producción corta (fail-closed, con error);
 * mismo criterio que `rateLimit.ts`. Token vacío o desmedido, error de red o timeout: corta.
 */
export const TURNSTILE_ERROR_MESSAGE = "No pudimos verificar que no seas un robot. Recargá la página y probá de nuevo.";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const FIELD_NAME = "cf-turnstile-response";
const MAX_TOKEN_LENGTH = 2048;
const TIMEOUT_MS = 5_000;

let warnedMissingSecret = false;

function missingSecretResult(): boolean {
  const isProd = process.env.NODE_ENV === "production";
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    if (isProd) console.error("[turnstile] falta TURNSTILE_SECRET_KEY: se rechazan todos los envíos");
    else console.warn("[turnstile] falta TURNSTILE_SECRET_KEY: se omite la verificación (solo desarrollo)");
  }
  return !isProd;
}

export async function verifyTurnstile(formData: FormData, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return missingSecretResult();

  const token = formData.get(FIELD_NAME);
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
