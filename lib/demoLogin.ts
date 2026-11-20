/**
 * ¿Está habilitado el selector de sesión demo? Requiere DEMO_LOGIN_ENABLED=true Y que el entorno NO sea producción de
 * Vercel (`VERCEL_ENV` solo existe en Vercel). Doble candado: aunque el flag se cargue por error en producción, el
 * widget y las server actions quedan apagados. No se usa `NODE_ENV` porque `next build && next start` local también es
 * "production" y la demo local debe seguir funcionando.
 */
export function isDemoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN_ENABLED === "true" && process.env.VERCEL_ENV !== "production";
}
