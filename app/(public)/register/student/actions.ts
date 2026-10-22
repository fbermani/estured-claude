"use server";

import { validatePassword } from "@/lib/auth/password";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";

export type RegisterState = { status: "idle" | "error"; message?: string };

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
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const birthDateRaw = String(formData.get("birth_date") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const acceptTerms = formData.get("accept_terms") === "on";
  const acceptPrivacy = formData.get("accept_privacy") === "on";
  // H04: casilla opcional y no premarcada. Solo cuenta para adultos.
  const wantsCommunity = formData.get("community_opt_in") === "on";

  // Validación server-side (docs/11 §5.2) — el cliente nunca es confiable.
  // Paso 1 del alta (Ciclo 35): solo identidad + contacto. Nacionalidad,
  // universidad, ciudad de origen y visibilidad de comunidad se completan
  // después en /students/profile, sin bloquear la cuenta.
  if (!firstName || firstName.length > 80)
    return { status: "error", message: "Contanos tu nombre." };
  if (!lastName || lastName.length > 80)
    return { status: "error", message: "Contanos tu apellido (nunca se muestra público)." };
  if (!EMAIL_RE.test(email) || email.length > 254)
    return { status: "error", message: "Revisá el email: no parece válido." };
  if (!/^[+0-9()\-\s]{6,25}$/.test(phone))
    return { status: "error", message: "Revisá el teléfono: usá números, espacios o «+»." };
  const passwordError = validatePassword(password);
  if (passwordError) return { status: "error", message: passwordError };
  if (!acceptTerms || !acceptPrivacy)
    return {
      status: "error",
      message: "Necesitamos que aceptes los términos y la política de privacidad.",
    };

  const birthDate = new Date(`${birthDateRaw}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()))
    return { status: "error", message: "Revisá la fecha de nacimiento." };
  const age = ageFrom(birthDate);
  if (age < 14 || age > 90)
    return { status: "error", message: "Revisá la fecha de nacimiento." };
  const isMinor = age < 18;
  // Menores: perfil de comunidad oculto y no modificable (docs/10 §9.2).
  const communityOptIn = wantsCommunity && !isMinor;

  const admin = getSupabaseAdmin();
  if (!admin)
    return {
      status: "error",
      message: "El registro no está disponible en este momento. Probá más tarde.",
    };

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
      return {
        status: "error",
        message: "Ya existe una cuenta con ese email. Podés iniciar sesión.",
      };
    }
    console.error("[register] createUser failed:", createError?.message);
    return {
      status: "error",
      message: "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.",
    };
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
    return {
      status: "error",
      message: "No pudimos completar el registro. Intentá de nuevo en unos minutos.",
    };
  }

  // 3. Iniciar sesión y entrar al área de estudiante.
  const supabase = await getSupabaseServer();
  if (supabase) {
    await supabase.auth.signInWithPassword({ email, password });
  }
  redirect("/students/dashboard");
}
