"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { DEMO_EMAILS } from "@/lib/dev/demo-users";

/**
 * Inicia sesión como un usuario demo (selector de sesión simulada).
 *
 * SOLO desarrollo. Doble bloqueo:
 * 1. El widget no se renderiza sin DEMO_LOGIN_ENABLED=true.
 * 2. Esta action rechaza la llamada si el flag no está activo o si el
 *    email no pertenece a la lista demo — aunque alguien la invoque a
 *    mano. En Vercel el flag no existe: imposible impersonar.
 *
 * Usa auth real (signInWithPassword): la sesión simulada pasa por RLS,
 * roles y redirects exactamente como una sesión verdadera.
 */
export async function impersonateDemoUser(formData: FormData): Promise<void> {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    throw new Error("Demo login deshabilitado.");
  }
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = process.env.DEMO_USERS_PASSWORD;
  if (!DEMO_EMAILS.has(email) || !password) {
    throw new Error("Usuario demo desconocido.");
  }

  const supabase = await getSupabaseServer();
  if (!supabase) throw new Error("Supabase no configurado.");

  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      "No se pudo iniciar la sesión demo. ¿Corriste scripts/seed-demo-users.mjs?",
    );
  }

  const user = await getSessionUser();
  redirect(user ? roleHome(user) : "/");
}

/** Cierra la sesión simulada y vuelve al home público. */
export async function exitDemoSession(): Promise<void> {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    throw new Error("Demo login deshabilitado.");
  }
  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
