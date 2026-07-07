import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con la sesión del usuario (cookies) — server-side.
 *
 * Usa la anon key: las lecturas pasan por RLS con la identidad del
 * usuario logueado. Para escrituras privilegiadas usar
 * `getSupabaseAdmin()` (lib/supabase/admin.ts) dentro de server actions.
 *
 * Devuelve null si faltan env vars (misma degradación intencional que
 * el cliente admin).
 */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component (no puede escribir cookies):
          // el refresh de sesión lo maneja el middleware.
        }
      },
    },
  });
}
