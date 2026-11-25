import "server-only";
import { cookies } from "next/headers";
import { ATTRIBUTION_COOKIE, parseAttributionCookie, type Attribution } from "@/lib/attribution/attribution";

/**
 * Atribución de la cookie `er-attr`, leída y saneada de nuevo en el servidor (la cookie la escribe el navegador: no es de fiar).
 * Nunca lanza: sin cookie, sin contexto de pedido o con un valor roto devuelve null y el alta sigue igual.
 */
export async function readAttribution(): Promise<Attribution | null> {
  try {
    const store = await cookies();
    return parseAttributionCookie(store.get(ATTRIBUTION_COOKIE)?.value);
  } catch {
    return null;
  }
}
