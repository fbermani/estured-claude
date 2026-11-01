"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createRateLimiter, clientKeyFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { formError, type RegisterFormState } from "@/app/(public)/register/formState";
import { validateSignupForm } from "@/lib/residenceSignup/rules";
import { createSignupRequest } from "@/lib/residenceSignup/signupRequests";

export type RequestResidenceState = RegisterFormState;

/** Freno best-effort por IP (en memoria, por instancia; el límite real va en el WAF de Vercel). La clave es un hash, nunca la IP. */
const attemptsByClient = createRateLimiter({ limit: 5, windowMs: 3_600_000 });

/**
 * Solicitud de alta de residencia (DR22 D/E1–E7): NO crea cuenta, usuario ni residencia. Guarda los datos principales en
 * `residence_signup_requests` (solo service role) para que el equipo de EstuRed contacte a la residencia. Sin plazos prometidos.
 */
export async function requestResidenceSignup(_prev: RequestResidenceState, formData: FormData): Promise<RequestResidenceState> {
  // Honeypot: invisible para humanos; si viene completo es un bot (respuesta de éxito, sin guardar).
  if (String(formData.get("company_site") ?? "") !== "") return { status: "success" };

  const raw: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") raw[k] = v;
  const result = validateSignupForm(raw);
  if (!result.ok) return formError(formData, result.message, result.field);

  const clientKey = createHash("sha256").update(clientKeyFromHeaders(await headers())).digest("hex");
  if (!attemptsByClient(clientKey)) return formError(formData, "Enviaste varias solicitudes seguidas. Probá de nuevo en un rato.");

  const admin = getSupabaseAdmin();
  if (!admin) return formError(formData, "El formulario no está disponible en este momento. Probá más tarde.");

  const saved = await createSignupRequest(admin, result.value);
  if (!saved.ok) return formError(formData, "No pudimos enviar tu solicitud. Intentá de nuevo en unos minutos.");
  return { status: "success" };
}
