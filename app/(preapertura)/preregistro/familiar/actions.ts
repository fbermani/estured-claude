"use server";

import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/auth/password";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/sendEmail";
import { SITE_URL } from "@/lib/siteUrl";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import { clientIpOf, createFamilyAccount } from "@/lib/preapertura/accounts";
import { PREAPERTURA_TOO_MANY_ATTEMPTS, signupAllowed } from "@/lib/preapertura/throttle";
import { isPlausibleEmail, normalizeEmail } from "@/lib/preapertura/validation";
import type { FamilyState } from "@/lib/preapertura/formState";

const UNAVAILABLE = "La preapertura todavía no está disponible. Probá de nuevo más tarde.";
const MAIL_UNAVAILABLE = "No pudimos enviar la invitación, probá más tarde. Lo que escribiste sigue acá.";
const GENERIC = "No pudimos crear tu cuenta. Probá de nuevo en un rato. Lo que escribiste sigue acá.";

function fail(message: string, values: FamilyState["values"], field?: string, code?: FamilyState["code"]): FamilyState {
  return { status: "error", message, values, ...(field ? { fieldErrors: { [field]: message } } : {}), ...(code ? { code } : {}) };
}

/**
 * Registro familiar de la preapertura (DR43.2): el familiar mayor crea su cuenta e invita a su hijo/a en un solo paso. Una sola
 * invitación, sin recordatorios. El familiar NO da consentimientos por el estudiante ni aprueba nada por él: el vínculo
 * (`family_links`, pendiente de aprobación) se crea cuando el estudiante canjea la invitación.
 *
 * SEGURIDAD: el token de la invitación NUNCA vuelve al familiar (ni en pantalla ni en la respuesta): sale solo por mail al email del
 * invitado, y el invitado no puede cambiar ese mail al canjear. Sin proveedor de mail (o si el envío falla) NO se emite la invitación:
 * se deshace el alta y se muestra un error claro. Única excepción: con `NODE_ENV === "development"` se devuelve el link para poder
 * probar sin mail. El familiar declara que es mayor de 18 años (casillero obligatorio, validado acá).
 */
export async function registerFamilyInvite(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  if (!isPreaperturaOn()) return fail(UNAVAILABLE, undefined);
  const headerStore = await headers();
  const email = normalizeEmail(formData.get("email"));
  const studentEmail = normalizeEmail(formData.get("student_email"));
  const password = String(formData.get("password") ?? "");
  const acceptTerms = formData.get("accept_terms") === "on";
  const declaredAdult = formData.get("accept_adult") === "on";
  const values = { email, student_email: studentEmail };
  const isDev = process.env.NODE_ENV === "development";

  if (!isPlausibleEmail(email)) return fail("Escribí tu email completo, por ejemplo nombre@gmail.com.", values, "email");
  const passwordError = validatePassword(password);
  if (passwordError) return fail(passwordError, values, "password");
  if (!isPlausibleEmail(studentEmail)) return fail("Escribí un email completo, por ejemplo nombre@gmail.com.", values, "student_email");
  if (studentEmail === email) return fail("Ese es tu email. Escribí el de tu hijo/a.", values, "student_email");
  if (!declaredAdult) return fail("Tenés que declarar que sos mayor de 18 años.", values, "accept_adult");
  if (!acceptTerms) return fail("Necesitamos que aceptes los Términos y la Privacidad para sumarte.", values, "accept_terms");
  if (!signupAllowed(headerStore, email)) return fail(PREAPERTURA_TOO_MANY_ATTEMPTS, values);

  // Sin proveedor de mail no hay forma de entregar la invitación: no se crea nada (solo en desarrollo se sigue, para probar con el link).
  if (!isDev && !isEmailProviderConfigured()) return fail(MAIL_UNAVAILABLE, values);

  const admin = getSupabaseAdmin();
  if (!admin) return fail(UNAVAILABLE, values);

  const result = await createFamilyAccount(admin, {
    email,
    password,
    inviteeEmail: studentEmail,
    declaredAdult,
    ip: clientIpOf(headerStore),
    userAgent: headerStore.get("user-agent"),
  });
  if (!result.ok) {
    if (result.reason === "email_exists") return fail("Ya hay una cuenta con ese email.", values, "email", "email_exists");
    return fail(result.reason === "unavailable" ? UNAVAILABLE : GENERIC, values);
  }

  const invitePath = `/preregistro?invitacion=${encodeURIComponent(result.inviteToken)}`;
  // La invitación sale por mail con el sitio configurado (nunca con el Host del pedido: evita que alguien arme mails con otro dominio).
  const emailSent = await sendEmail({
    to: studentEmail,
    subject: "Te invitaron a sumarte a EstuRed",
    html: `<p>Un familiar te invitó a sumarte a EstuRed, la plataforma para encontrar residencias estudiantiles verificadas en Buenos Aires.</p><p><a href="${SITE_URL}${invitePath}">Sumate desde este link</a></p><p>Si no esperabas este mensaje, ignoralo.</p>`,
  });
  if (!emailSent && !isDev) {
    // El mail no salió: sin entrega no hay invitación. Se deshace el alta (cascada) para que el familiar pueda reintentar con el mismo email.
    await admin.auth.admin.deleteUser(result.userId).catch(() => {});
    return fail(MAIL_UNAVAILABLE, values);
  }

  const supabase = await getSupabaseServer();
  if (supabase) await supabase.auth.signInWithPassword({ email, password });

  return {
    status: "success",
    inviteeEmail: studentEmail,
    emailSent,
    redirectTo: "/mi-lugar",
    // Solo desarrollo: el link para probar sin mail. En producción el token no sale del servidor ni del mail al invitado.
    ...(isDev ? { invitePath } : {}),
  };
}
