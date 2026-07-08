"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";

export type RegisterFamilyState = { status: "idle" | "error"; message?: string };

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
    return { status: "error", message: "Contanos tu nombre." };
  if (!lastName || lastName.length > 80)
    return { status: "error", message: "Contanos tu apellido." };
  if (!RELATIONSHIPS.has(relationship))
    return { status: "error", message: "Elegí tu relación con el estudiante." };
  if (!/^[+0-9()\-\s]{6,25}$/.test(phone))
    return { status: "error", message: "Revisá el teléfono: usá números, espacios o «+»." };
  if (!EMAIL_RE.test(email) || email.length > 254)
    return { status: "error", message: "Revisá tu email: no parece válido." };
  if (password.length < 8)
    return { status: "error", message: "La contraseña debe tener al menos 8 caracteres." };
  if (!EMAIL_RE.test(studentEmail))
    return { status: "error", message: "Revisá el email del estudiante: no parece válido." };
  if (studentEmail === email)
    return { status: "error", message: "El email del estudiante no puede ser el mismo que el tuyo." };
  if (!acceptTerms || !acceptPrivacy)
    return {
      status: "error",
      message: "Necesitamos que aceptes los términos y la política de privacidad.",
    };

  const admin = getSupabaseAdmin();
  if (!admin)
    return {
      status: "error",
      message: "El registro no está disponible en este momento. Probá más tarde.",
    };

  // Buscar al estudiante ANTES de crear la cuenta del familiar — evita
  // dejar cuentas huérfanas si el email no corresponde a un estudiante.
  const { data: studentUser } = await admin
    .from("users")
    .select("id")
    .eq("email", studentEmail)
    .maybeSingle();
  if (!studentUser) {
    return {
      status: "error",
      message:
        "No encontramos una cuenta de estudiante con ese email. Pedile que se registre primero en EstuRed.",
    };
  }
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", studentUser.id)
    .maybeSingle();
  if (!studentProfile) {
    return { status: "error", message: "Esa cuenta no tiene un perfil de estudiante válido." };
  }
  const { data: activeLink } = await admin
    .from("family_links")
    .select("id")
    .eq("student_profile_id", studentProfile.id)
    .eq("status", "active")
    .maybeSingle();
  if (activeLink) {
    return {
      status: "error",
      message: "Ese estudiante ya tiene un familiar vinculado activo.",
    };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
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
    console.error("[register-family] createUser failed:", createError?.message);
    return {
      status: "error",
      message: "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.",
    };
  }

  const userId = created.user.id;
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
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
    return {
      status: "error",
      message: "No pudimos completar el registro. Intentá de nuevo en unos minutos.",
    };
  }

  const supabase = await getSupabaseServer();
  if (supabase) {
    await supabase.auth.signInWithPassword({ email, password });
  }
  redirect("/students/dashboard");
}
