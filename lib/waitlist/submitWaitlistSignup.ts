import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMIT_MAX_PER_HOUR = 5;

export type SubmitWaitlistSignupResult = { ok: true } | { ok: false; error: string };

/**
 * Inserta en `waitlist_signups` con rate limiting por IP (GAPS.md "Sin
 * rate limiting..."). El único filtro previo era un honeypot, que un
 * script trivial puede omitir — esto frena spam masivo con emails
 * únicos falsos desde el mismo origen (el índice único en `lower(email)`
 * ya cubre duplicados exactos, no este caso).
 *
 * Extraída del server action (mismo patrón ya usado en el resto del
 * proyecto para lógica testeable sin `next/headers`) — recibe el
 * `ipHash` ya calculado, no resuelve el request acá.
 */
export async function submitWaitlistSignup(
  admin: SupabaseClient,
  params: {
    role: string;
    name: string;
    email: string;
    city: string | null;
    message: string | null;
    ipHash: string | null;
    privacyConsentGiven: boolean;
  },
): Promise<SubmitWaitlistSignupResult> {
  if (!params.privacyConsentGiven) {
    return { ok: false, error: "Tenés que aceptar la política de privacidad para sumarte a la lista." };
  }

  if (params.ipHash) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("waitlist_signups")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", params.ipHash)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= RATE_LIMIT_MAX_PER_HOUR) {
      return { ok: false, error: "Ya recibimos varias solicitudes desde acá. Probá de nuevo más tarde." };
    }
  }

  const { error } = await admin.from("waitlist_signups").insert({
    role: params.role,
    name: params.name,
    email: params.email,
    city: params.city,
    message: params.message,
    ip_hash: params.ipHash,
    privacy_consent_at: new Date().toISOString(),
  });

  if (error) {
    // 23505 = unique_violation: el email ya estaba anotado. Para el
    // usuario es un éxito idempotente, no un error.
    if (error.code === "23505") return { ok: true };
    console.error("[waitlist] insert failed:", error.code, error.message);
    return { ok: false, error: "No pudimos guardar tus datos. Intentá de nuevo en unos minutos." };
  }

  return { ok: true };
}
