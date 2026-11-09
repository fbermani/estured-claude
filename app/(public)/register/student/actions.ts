"use server";

import { isPreaperturaOn } from "@/lib/preapertura/flag";
import { safeInternalPath } from "@/lib/auth/safeNext";
import { validatePassword } from "@/lib/auth/password";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { formError, type RegisterFormState } from "@/app/(public)/register/formState";
import { activateResidentStay } from "@/lib/residents/activateResidentStay";
import { otpRequiredFor, resolveInviteByToken } from "@/lib/residents/inviteVerification";
import { submitLinkRequest, submitMissingResidence } from "@/lib/residents/linkRequestsStudent";
import { INVITE_TOO_MANY_ATTEMPTS, inviteAttemptAllowed } from "@/lib/residents/inviteThrottle";

export type RegisterState = RegisterFormState;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Versión de los textos legales aceptados. Borrador: docs/10 y docs/21
 * requieren revisión legal profesional antes del lanzamiento comercial. */
const CONSENT_VERSION = "v0.1-borrador";

function ageFrom(birthDate: Date, today = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Registro de estudiante (docs/08 §5.3).
 *
 * Crea: auth user (pre-confirmado — sin verificación de email mientras
 * el proveedor de email sea un pendiente de docs/00 §29), fila en
 * users, rol student, student_profile, visibility settings (defaults
 * privados) y consents versionados. Audita el alta. Si algo falla a
 * mitad de camino, borra el auth user para no dejar cuentas huérfanas.
 */
export async function registerStudent(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // Con la preapertura encendida esta alta (desde 14 años) está cerrada: el alta es `/preregistro`. Se corta acá y no solo en la página
  // porque una acción de servidor se puede invocar sin pasar por la página.
  if (isPreaperturaOn()) return formError(formData, "El registro todavía no está abierto. Sumate desde la página de inicio.");
  const inviteToken = String(formData.get("invite") ?? "").trim();
  // Destino tras el alta (p. ej. la ficha con el tipo elegido). Solo rutas internas; si no pasa el validador se ignora.
  const afterSignup = safeInternalPath(String(formData.get("next") ?? ""));
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const birthDateRaw = String(formData.get("birth_date") ?? "").trim();
  let email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const acceptTerms = formData.get("accept_terms") === "on";
  const acceptPrivacy = formData.get("accept_privacy") === "on";
  // H04: casilla opcional y no premarcada. Solo cuenta para adultos.
  const wantsCommunity = formData.get("community_opt_in") === "on";

  // Invitación personal (DR19): el mail NO sale del formulario sino de la invitación (el enlace es la prueba). Si llegó por WhatsApp o la
  // residencia no cargó mail, el mail tiene que estar verificado con el código antes de crear la cuenta.
  if (inviteToken) {
    const headerStore = await headers();
    if (!inviteAttemptAllowed(headerStore, inviteToken)) return formError(formData, INVITE_TOO_MANY_ATTEMPTS);
    const inviteAdmin = getSupabaseAdmin();
    if (!inviteAdmin) return formError(formData, "El registro no está disponible en este momento. Probá más tarde.");
    const resolved = await resolveInviteByToken(inviteAdmin, inviteToken);
    if (!resolved.ok) return formError(formData, resolved.message);
    const needsCode = otpRequiredFor(resolved.invite.channel, !!resolved.stay.invite_email);
    if (needsCode && !resolved.invite.otp_verified_at) {
      return formError(formData, "Primero verificá tu mail con el código que te mandamos.");
    }
    email = (needsCode ? (resolved.invite.otp_email ?? "") : (resolved.stay.invite_email ?? "")).trim().toLowerCase();
  }

  // DR21: «Ya vivo en una residencia» (solo sin invitación). Elegir de la lista y escribir un nombre a la vez es ambiguo: se pide una sola.
  const linkResidenceId = inviteToken ? "" : String(formData.get("link_residence_id") ?? "").trim();
  const missingName = inviteToken ? "" : String(formData.get("missing_residence_name") ?? "").trim();
  if (linkResidenceId && missingName)
    return formError(formData, "Elegí tu residencia de la lista o escribí su nombre, pero no las dos cosas.", "missing_residence_name");

  // Validación server-side (docs/11 §5.2) — el cliente nunca es confiable.
  // Paso 1 del alta (Ciclo 35): solo identidad + contacto. Nacionalidad,
  // universidad, ciudad de origen y visibilidad de comunidad se completan
  // después en /students/profile, sin bloquear la cuenta.
  if (!firstName || firstName.length > 80)
    return formError(formData, "Contanos tu nombre.", "first_name");
  if (!lastName || lastName.length > 80)
    return formError(formData, "Contanos tu apellido (nunca se muestra público).", "last_name");
  if (!EMAIL_RE.test(email) || email.length > 254)
    return formError(formData, "Revisá el email: no parece válido.", "email");
  if (!/^[+0-9()\-\s]{6,25}$/.test(phone))
    return formError(formData, "Revisá el teléfono: usá números, espacios o «+».", "phone");
  const passwordError = validatePassword(password);
  if (passwordError) return formError(formData, passwordError, "password");
  if (!acceptTerms || !acceptPrivacy)
    return formError(formData, "Necesitamos que aceptes los términos y la política de privacidad.");

  const birthDate = new Date(`${birthDateRaw}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()))
    return formError(formData, "Revisá la fecha de nacimiento.", "birth_date");
  const age = ageFrom(birthDate);
  if (age < 14 || age > 90)
    return formError(formData, "Revisá la fecha de nacimiento.", "birth_date");
  const isMinor = age < 18;
  // Menores: perfil de comunidad oculto y no modificable (docs/10 §9.2).
  const communityOptIn = wantsCommunity && !isMinor;

  const admin = getSupabaseAdmin();
  if (!admin)
    return formError(formData, "El registro no está disponible en este momento. Probá más tarde.");

  // 1. Usuario de auth, pre-confirmado.
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName },
    });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return formError(
        formData,
        inviteToken
          ? "Ese mail ya tiene cuenta en EstuRed. Iniciá sesión y activamos tu estadía con este mismo enlace."
          : "Ya existe una cuenta con ese email. Podés iniciar sesión.",
        inviteToken ? undefined : "email",
      );
    }
    console.error("[register] createUser failed:", createError?.message);
    return formError(formData, "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.");
  }

  const userId = created.user.id;
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");

  try {
    // 2. Identidad de aplicación + rol + perfil + visibilidad + consents.
    const { error: userError } = await admin.from("users").insert({
      id: userId,
      email,
      phone,
      primary_role: "student",
    });
    if (userError) throw userError;

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: userId,
      role: "student",
      scope_type: "global",
    });
    if (roleError) throw roleError;

    const { data: profile, error: profileError } = await admin
      .from("student_profiles")
      .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        last_initial: lastName.charAt(0).toUpperCase() + ".",
        birth_date: birthDateRaw,
        display_age: age,
        nationality: null,
        origin_city: null,
        study_institution_private: null,
        is_minor: isMinor,
      })
      .select("id")
      .single();
    if (profileError || !profile) throw profileError;

    // Visibilidad de comunidad: default privado. Solo se activa si un adulto
    // marcó la casilla de consentimiento opcional (H04); los datos sueltos
    // (`show_*`) quedan en false hasta que los elija en su perfil.
    const { error: visibilityError } = await admin
      .from("student_visibility_settings")
      .insert({
        student_profile_id: profile.id,
        is_individual_profile_visible: communityOptIn,
      });
    if (visibilityError) throw visibilityError;

    const consentBase = {
      user_id: userId,
      version: CONSENT_VERSION,
      ip_address: ip,
      user_agent: userAgent,
    };
    const { error: consentError } = await admin.from("consents").insert([
      { ...consentBase, consent_type: "terms", metadata: {} },
      { ...consentBase, consent_type: "privacy", metadata: {} },
      ...(communityOptIn
        ? [
            {
              ...consentBase,
              consent_type: "student_visibility",
              metadata: { is_individual_profile_visible: true, source: "registration" },
            },
          ]
        : []),
    ]);
    if (consentError) throw consentError;

    await createAuditLog(admin, {
      actorUserId: userId,
      actorRole: "student",
      action: "student_registered",
      entityType: "users",
      entityId: userId,
      newValue: { is_minor: isMinor, community_opt_in: communityOptIn },
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    console.error("[register] rollback, insert failed:", error);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return formError(formData, "No pudimos completar el registro. Intentá de nuevo en unos minutos.");
  }

  // 3. Iniciar sesión y entrar al área de estudiante.
  const supabase = await getSupabaseServer();
  if (supabase) {
    await supabase.auth.signInWithPassword({ email, password });
  }
  if (inviteToken) {
    // Con enlace válido la estadía queda activa sin pasos extra. Si no se puede todavía (p. ej. menor sin tutor), la pantalla del enlace explica por qué.
    const activation = await activateResidentStay(admin, { actorUserId: userId, rawToken: inviteToken });
    redirect(activation.ok ? (activation.pendingConfirmation ? "/students/residency?pendiente=1" : "/students/residency") : `/students/residency/invite?invite=${encodeURIComponent(inviteToken)}`);
  }

  // DR21: «Ya vivo en una residencia» sin invitación. Mejor esfuerzo: si falla, la cuenta ya está creada y se repite desde «Mi residencia».
  // Nada se vincula acá: la residencia tiene que aprobar la solicitud (DR19).
  let residenceNoticeSent = false;
  if (linkResidenceId || missingName) {
    try {
      const outcome = linkResidenceId
        ? await submitLinkRequest(admin, { actorUserId: userId, residenceId: linkResidenceId })
        : await submitMissingResidence(admin, { actorUserId: userId, residenceName: missingName });
      residenceNoticeSent = outcome.ok;
    } catch (error) {
      console.error("[register] aviso de residencia falló:", error);
    }
    // Falló: la cuenta ya existe; se avisa en el destino para repetirlo desde «Mi residencia».
    if (!residenceNoticeSent) redirect("/students/residency?aviso=error");
    redirect(afterSignup ?? "/students/residency");
  }
  redirect(afterSignup ?? "/students/dashboard");
}
