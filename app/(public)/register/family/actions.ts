"use server";

import { clientIpFromHeaders, clientKeyFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import { sendFamilyEmailCode } from "@/lib/family/emailVerification";
import { validatePassword } from "@/lib/auth/password";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { formError, type RegisterFormState } from "@/app/(public)/register/formState";

export type RegisterFamilyState = RegisterFormState;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONSENT_VERSION = "v0.1-borrador";
const RELATIONSHIPS = new Set(["padre", "madre", "tutor", "familiar"]);

/**
 * Registro de familiar + solicitud de vinculación en un solo paso
 * (docs/08 §5.5, docs/00 §17). El modelo documental describe "buscar o
 * invitar" al estudiante como pasos separados; acá se simplifica a
 * "buscar por email" — invitar a alguien sin cuenta todavía requiere
 * email transaccional, que sigue pendiente (docs/00 §29).
 */
export async function registerFamily(
  _prev: RegisterFamilyState,
  formData: FormData,
): Promise<RegisterFamilyState> {
  // Con la preapertura encendida el alta familiar es `/preregistro/familiar`: acá se corta en el servidor (la acción se puede invocar sin la página).
  if (isPreaperturaOn()) return formError(formData, "El registro todavía no está abierto. Sumate desde la página de inicio.");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const relationship = String(formData.get("relationship_type") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const studentEmail = String(formData.get("student_email") ?? "")
    .trim()
    .toLowerCase();
  const acceptTerms = formData.get("accept_terms") === "on";
  const acceptPrivacy = formData.get("accept_privacy") === "on";

  if (!firstName || firstName.length > 80)
    return formError(formData, "Contanos tu nombre.", "first_name");
  if (!lastName || lastName.length > 80)
    return formError(formData, "Contanos tu apellido.", "last_name");
  if (!RELATIONSHIPS.has(relationship))
    return formError(formData, "Elegí tu relación con el estudiante.", "relationship_type");
  if (!/^[+0-9()\-\s]{6,25}$/.test(phone))
    return formError(formData, "Revisá el teléfono: usá números, espacios o «+».", "phone");
  if (!EMAIL_RE.test(email) || email.length > 254)
    return formError(formData, "Revisá tu email: no parece válido.", "email");
  const passwordError = validatePassword(password);
  if (passwordError) return formError(formData, passwordError, "password");
  if (!EMAIL_RE.test(studentEmail))
    return formError(formData, "Revisá el email del estudiante: no parece válido.", "student_email");
  if (studentEmail === email)
    return formError(formData, "El email del estudiante no puede ser el mismo que el tuyo.", "student_email");
  if (!acceptTerms || !acceptPrivacy)
    return formError(formData, "Necesitamos que aceptes los términos y la política de privacidad.");

  // M6: 25 altas por hora por IP, persistente. Va antes de buscar al estudiante: también acota el uso del formulario para sondear emails.
  const signupLimit = await consumeRateLimit({ bucket: "register_family_ip", key: clientKeyFromHeaders(await headers()), windowSeconds: 3_600, max: 25 });
  if (!signupLimit.ok) return formError(formData, "Hiciste muchos intentos. Probá de nuevo en un rato.");

  const admin = getSupabaseAdmin();
  if (!admin)
    return formError(formData, "El registro no está disponible en este momento. Probá más tarde.");

  // Buscar al estudiante ANTES de crear la cuenta del familiar — evita
  // dejar cuentas huérfanas si el email no corresponde a un estudiante.
  // M6 (enumeración): un único mensaje para «no existe», «no es estudiante» y «ya tiene un familiar vinculado», así el formulario no
  // revela si un email es de un estudiante (incluidos menores), de otra cuenta (p. ej. admin) ni si ya tiene familiar.
  const studentNotLinkable = () =>
    formError(
      formData,
      "No pudimos enviar la solicitud a ese email. Revisá que sea el mismo con el que el estudiante se registró en EstuRed; si todavía no tiene cuenta, pedile que se registre primero.",
      "student_email",
    );
  const { data: studentUser } = await admin
    .from("users")
    .select("id")
    .eq("email", studentEmail)
    .maybeSingle();
  if (!studentUser) return studentNotLinkable();
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", studentUser.id)
    .maybeSingle();
  if (!studentProfile) return studentNotLinkable();
  const { data: activeLink } = await admin
    .from("family_links")
    .select("id")
    .eq("student_profile_id", studentProfile.id)
    .eq("status", "active")
    .maybeSingle();
  if (activeLink) return studentNotLinkable();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return formError(formData, "Ya existe una cuenta con ese email. Podés iniciar sesión.", "email");
    }
    console.error("[register-family] createUser failed:", createError?.message);
    return formError(formData, "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.");
  }

  const userId = created.user.id;
  const headerStore = await headers();
  const ip = clientIpFromHeaders(headerStore);
  const userAgent = headerStore.get("user-agent");

  try {
    const { error: userError } = await admin.from("users").insert({
      id: userId,
      email,
      phone,
      primary_role: "family_member",
    });
    if (userError) throw userError;

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: userId,
      role: "family_member",
      scope_type: "global",
    });
    if (roleError) throw roleError;

    const { data: familyMember, error: familyError } = await admin
      .from("family_members")
      .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        relationship_type: relationship,
        phone,
      })
      .select("id")
      .single();
    if (familyError || !familyMember) throw familyError;

    const { error: linkError } = await admin.from("family_links").insert({
      student_profile_id: studentProfile.id,
      family_member_id: familyMember.id,
      status: "pending_student_approval",
      requested_by_user_id: userId,
    });
    if (linkError) throw linkError;

    const consentBase = {
      user_id: userId,
      version: CONSENT_VERSION,
      ip_address: ip,
      user_agent: userAgent,
    };
    const { error: consentError } = await admin.from("consents").insert([
      { ...consentBase, consent_type: "terms", metadata: {} },
      { ...consentBase, consent_type: "privacy", metadata: {} },
    ]);
    if (consentError) throw consentError;

    await createAuditLog(admin, {
      actorUserId: userId,
      actorRole: "family_member",
      action: "family_registered_and_link_requested",
      entityType: "family_links",
      entityId: studentProfile.id,
      newValue: { relationship, student_email: studentEmail },
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    console.error("[register-family] rollback, insert failed:", error);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return formError(formData, "No pudimos completar el registro. Intentá de nuevo en unos minutos.");
  }

  // DR32 addendum: el estudiante no puede aprobar el vínculo hasta que el familiar verifique su mail con este código.
  await sendFamilyEmailCode(admin, userId);

  const supabase = await getSupabaseServer();
  if (supabase) {
    await supabase.auth.signInWithPassword({ email, password });
  }
  redirect("/students/dashboard");
}
