"use server";

import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/waitlist/hashIp";
import { submitWaitlistSignup } from "@/lib/waitlist/submitWaitlistSignup";

export type WaitlistState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const VALID_ROLES = new Set(["student", "family", "residence"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Vercel/proxies estándar inyectan `x-forwarded-for`; sin proxy (dev local) no hay IP y el rate limit simplemente no aplica. */
async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerList.get("x-real-ip");
}

/**
 * Alta en la lista de espera pre-lanzamiento.
 *
 * Validación server-side siempre (docs/11 §5.2): el cliente nunca es
 * confiable. Inserta vía service role; la tabla tiene RLS sin policies,
 * así que el rol anónimo no puede leer ni escribir directamente.
 */
export async function submitWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  // Honeypot: campo invisible para humanos; si viene completo, es un bot.
  if (String(formData.get("website") ?? "") !== "") {
    return { status: "success" };
  }

  const role = String(formData.get("role") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const city = String(formData.get("city") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!VALID_ROLES.has(role)) {
    return { status: "error", message: "Elegí una opción válida en «Soy…»." };
  }
  if (name.length < 1 || name.length > 120) {
    return { status: "error", message: "Contanos tu nombre (hasta 120 caracteres)." };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: "error", message: "Revisá el email: no parece válido." };
  }
  if (city.length > 120 || message.length > 2000) {
    return {
      status: "error",
      message: "El texto es demasiado largo. Acortalo un poco e intentá de nuevo.",
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      status: "error",
      message:
        "Todavía estamos conectando la base de datos. Probá de nuevo en un rato o escribinos.",
    };
  }

  const clientIp = await getClientIp();
  const ipHash = clientIp ? await hashIp(clientIp) : null;
  const privacyConsentGiven = formData.get("privacy_consent") === "on";

  const result = await submitWaitlistSignup(supabase, {
    role,
    name,
    email,
    city: city || null,
    message: message || null,
    ipHash,
    privacyConsentGiven,
  });
  if (!result.ok) return { status: "error", message: result.error };

  return { status: "success" };
}
