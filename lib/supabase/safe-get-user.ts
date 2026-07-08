import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Wrapper de `supabase.auth.getUser()` que nunca revienta el render.
 *
 * Bug real (encontrado en producción local, 2026-07-08): si la cookie
 * del navegador trae un refresh token que ya no es válido en Supabase
 * (ej: el usuario fue borrado por un script, o la sesión quedó de un
 * proyecto/entorno anterior), el SDK lanza `AuthApiError: Invalid
 * Refresh Token: Refresh Token Not Found` de forma no capturada durante
 * su intento interno de auto-refresh — no como un `{ error }` normal.
 * Esto tira abajo el árbol de render entero (el error salía en
 * app/layout.tsx, sin relación directa con el componente que lo usaba).
 *
 * Fix: capturar cualquier falla acá y tratarla como "sin sesión", más
 * limpiar la cookie corrupta con signOut({ scope: "local" }) — no pega
 * al servidor (que ya considera el token inválido), solo borra la
 * cookie para que el próximo request no vuelva a fallar igual.
 */
export async function getSafeUser(supabase: SupabaseClient): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.warn("[auth] getUser failed, treating as signed out:", error);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Si ni siquiera el signOut local funciona, no hay más que hacer
      // acá — el navegador va a seguir mandando la cookie corrupta,
      // pero al menos esta request no explota.
    }
    return null;
  }
}
