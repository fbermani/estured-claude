/**
 * Opciones endurecidas para las cookies de sesión de Supabase (auditoría M4) y cookie-pista `er-has-session`.
 * Sin imports de servidor: lo usan `lib/supabase/server.ts` y `middleware.ts` (edge).
 */

/** Cookie propia, NO sensible y legible por JS: solo indica "puede haber sesión" para la navbar pública (la confirma /api/session). */
export const SESSION_HINT_COOKIE = "er-has-session";

type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
};

const isProd = () => process.env.NODE_ENV === "production";

/** Las cookies `sb-*-auth-token` (y sus fragmentos `.0`, `.1`) no deben ser legibles desde el navegador. */
export function hardenAuthCookie(options: CookieOptions | undefined): CookieOptions {
  return { ...options, httpOnly: true, secure: isProd(), sameSite: "lax" };
}

type CookieToSet = { name: string; value: string; options: CookieOptions };

const isAuthTokenCookie = (name: string) => name.startsWith("sb-") && name.includes("auth-token") && !name.endsWith("-code-verifier");

/**
 * Deriva la cookie-pista de lo que Supabase está escribiendo: si setea (o renueva) un `auth-token` con valor, la pone; si lo borra
 * (valor vacío / maxAge 0 / expirada, como en signOut), la borra. Devuelve null si no se tocó ninguna cookie de sesión.
 */
export function sessionHintFor(cookiesToSet: CookieToSet[]): CookieToSet | null {
  const auth = cookiesToSet.filter((c) => isAuthTokenCookie(c.name));
  if (auth.length === 0) return null;
  const alive = auth.find(
    (c) => c.value !== "" && !(c.options?.maxAge !== undefined && c.options.maxAge <= 0) && !(c.options?.expires && c.options.expires.getTime() <= Date.now()),
  );
  const base = { path: "/", httpOnly: false, secure: isProd(), sameSite: "lax" as const };
  if (!alive) return { name: SESSION_HINT_COOKIE, value: "", options: { ...base, maxAge: 0 } };
  return { name: SESSION_HINT_COOKIE, value: "1", options: { ...base, maxAge: alive.options?.maxAge ?? 400 * 24 * 60 * 60 } };
}
