"use server";

import { headers } from "next/headers";
import { readAttribution } from "@/lib/attribution/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { clientIpFromHeaders, clientKeyFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstile } from "@/lib/security/turnstile";
import { consumeRateLimit, emailRateLimitKey } from "@/lib/security/rateLimit";
import type { RegisterFormState } from "@/app/(public)/register/formState";
import { SIGNUP_ALERT_EMPTY, SIGNUP_ALERT_INVALID, validateSignupFields } from "@/lib/residenceSignup/rules";
import { createSignupRequest } from "@/lib/residenceSignup/signupRequests";
import { buildResidenceConfirmationEmail } from "@/lib/residenceSignup/confirmationEmail";
import { getFounderClosure, getFounderInputs } from "@/lib/preapertura/counts";
import { founderPlace, founderState, type FounderPlace } from "@/lib/preapertura/rules";
import { devAutoAccountsEnabled, devResidenceData } from "@/lib/preapertura/devAccounts";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import { sendEmail } from "@/lib/email/sendEmail";
import { CONTACT_EMAIL } from "@/lib/constants/contact";

/** `founder` solo viaja en `success` y solo con preapertura encendida: define el recuadro de la pantalla de éxito. */
export type RequestResidenceState = RegisterFormState & {
  founder?: FounderPlace;
  /** Solo desarrollo: mail de la solicitud de prueba autogenerada (envío vacío). */
  devEmail?: string;
};

/** Los valores no sensibles se repueblan tras un error: nada de lo escrito se pierde. */
function rawValues(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$ACTION") && k !== "company_site") raw[k] = v;
  return raw;
}

function failure(message: string, values: Record<string, string>, fieldErrors?: Record<string, string>): RequestResidenceState {
  return { status: "error", message, values, ...(fieldErrors && Object.keys(fieldErrors).length ? { fieldErrors } : {}) };
}

/**
 * Solicitud de alta de residencia (DR22 D/E1–E7, DR46.4): NO crea cuenta, usuario ni residencia. Pide 5 datos OBLIGATORIOS (nombre de la
 * residencia, dirección, responsable, teléfono/WhatsApp y email) y los valida SIEMPRE en el servidor (el cliente solo ayuda). Guarda en
 * `residence_signup_requests` (solo service role) para que el equipo contacte a la residencia. Sin plazos prometidos. Con preapertura
 * encendida además devuelve el lugar de fundadora (según el cupo real de ANTES de guardar) y manda el mail de confirmación; sin mail
 * configurado o si el proveedor falla, la solicitud igual queda guardada (el mail es de cortesía).
 */
export async function requestResidenceSignup(_prev: RequestResidenceState, formData: FormData): Promise<RequestResidenceState> {
  // Honeypot: invisible para humanos; si viene completo es un bot (respuesta de éxito, sin guardar).
  if (String(formData.get("company_site") ?? "") !== "") return { status: "success" };

  let raw = rawValues(formData);
  // SOLO DESARROLLO: el envío completamente vacío crea una solicitud de PRUEBA identificable (`test-resi-…@estured.test`, nombre «Residencia de
  // prueba …») y sigue a la pantalla de éxito. Con cualquier campo escrito, o fuera de desarrollo (producción y tests), validación normal.
  const devAuto = devAutoAccountsEnabled() && ["residence_name", "address", "contact_name", "phone", "email", "instagram_or_web", "approx_beds"].every((k) => !(raw[k] ?? "").trim());
  if (devAuto) raw = { ...raw, ...devResidenceData() };
  const result = validateSignupFields(raw);
  if (!result.value) return failure(result.anyRequiredEmpty ? SIGNUP_ALERT_EMPTY : SIGNUP_ALERT_INVALID, raw, result.errors);

  // S1: CAPTCHA antes de cualquier límite o escritura (el formulario es público y cada email nuevo dispara un mail de EstuRed).
  if (!devAuto && !(await verifyTurnstile(formData, clientIpFromHeaders(await headers())))) return failure(TURNSTILE_ERROR_MESSAGE, raw);

  // Frenos persistentes en Postgres (no se pierden por instancia): por IP y, aparte, por email (evita mandar mails de confirmación a
  // un tercero desde muchas IP). Van después de validar y antes de guardar; el duplicado también cuenta.
  if (!devAuto) {
    const byIp = await consumeRateLimit({ bucket: "residence_signup_ip", key: clientKeyFromHeaders(await headers()), windowSeconds: 3_600, max: 5 });
    if (!byIp.ok) return failure("Enviaste varias solicitudes seguidas. Probá de nuevo en un rato.", raw);
    const byEmail = await consumeRateLimit({ bucket: "residence_signup_email", key: emailRateLimitKey(result.value.email), windowSeconds: 3_600, max: 3 });
    if (!byEmail.ok) return failure("Ya recibimos varias solicitudes con ese email. Probá de nuevo más tarde o escribinos.", raw);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return failure("El formulario no está disponible en este momento. Probá más tarde.", raw);

  // Cupo de fundadoras ANTES de guardar (así sabemos si esta solicitud ocupa un lugar o si ya estaba todo el cupo en proceso).
  const preapertura = isPreaperturaOn();
  const place: FounderPlace | undefined = preapertura ? founderPlace(founderState(await getFounderInputs()), getFounderClosure()) : undefined;

  const saved = await createSignupRequest(admin, result.value, await readAttribution());
  if (!saved.ok) return failure("No pudimos enviar tu solicitud. Intentá de nuevo en unos minutos. Lo que escribiste sigue acá.", raw);

  // Un duplicado activo cuenta como éxito pero no repite el mail (evita usar el formulario para mandar mails a un tercero).
  if (preapertura && !saved.duplicate && !devAuto) {
    await sendEmail({
      to: result.value.email,
      replyTo: CONTACT_EMAIL,
      ...buildResidenceConfirmationEmail({
        contactName: result.value.contact_name,
        residenceName: result.value.residence_name,
        address: result.value.address,
        place: place ?? "unknown",
        contactEmail: CONTACT_EMAIL,
      }),
    });
  }
  return { status: "success", ...(place ? { founder: place } : {}), ...(devAuto ? { devEmail: result.value.email } : {}) };
}
