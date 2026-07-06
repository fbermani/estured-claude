import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service role — SOLO server-side.
 *
 * Regla (docs/15, docs/11 §9.3): la service role key salta RLS y nunca
 * debe llegar al cliente. Usar únicamente dentro de server actions o
 * route handlers, para operaciones que el rol anónimo no debe poder
 * hacer directamente (ej. insertar en waitlist_signups).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
