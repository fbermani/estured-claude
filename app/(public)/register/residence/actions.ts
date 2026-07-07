"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { PROPERTY_TYPE_OPTIONS, ZONE_OPTIONS } from "@/lib/residences/options";

export type RegisterResidenceState = { status: "idle" | "error"; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONSENT_VERSION = "v0.1-borrador";
const PROPERTY_TYPES = new Set(PROPERTY_TYPE_OPTIONS.map((o) => o.value));
const ZONES = new Set<string>(ZONE_OPTIONS);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Alta inicial de residencia (docs/08 §5.6, docs/12 §6.2).
 *
 * Crea la cuenta del responsable (owner), la residencia en estado
 * `draft` y todo el andamiaje (residence_users, residence_verifications,
 * consents), audita el alta y redirige al formulario de perfil.
 * Modo elegido: siempre `verified_profile` en el alta — Gestión
 * Operativa es plan pago y se otorga por admin (docs/00 §6.2),
 * nunca autoseleccionable en el registro.
 */
export async function registerResidence(
  _prev: RegisterResidenceState,
  formData: FormData,
): Promise<RegisterResidenceState> {
  const responsibleName = String(formData.get("responsible_name") ?? "").trim();
  const residenceName = String(formData.get("residence_name") ?? "").trim();
  const propertyType = String(formData.get("property_type") ?? "").trim();
  const zone = String(formData.get("zone") ?? "").trim();
  const addressLine = String(formData.get("address_line") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const acceptTerms = formData.get("accept_terms") === "on";
  const acceptResponsibility = formData.get("accept_responsibility") === "on";

  if (!responsibleName || responsibleName.length > 120)
    return { status: "error", message: "Contanos el nombre del responsable." };
  if (!residenceName || residenceName.length > 160)
    return { status: "error", message: "Contanos el nombre de la residencia." };
  if (!PROPERTY_TYPES.has(propertyType as (typeof PROPERTY_TYPE_OPTIONS)[number]["value"]))
    return { status: "error", message: "Elegí un tipo de propiedad válido." };
  if (!ZONES.has(zone))
    return { status: "error", message: "Elegí una zona válida." };
  if (!addressLine || addressLine.length > 200)
    return { status: "error", message: "Contanos la dirección completa." };
  if (!EMAIL_RE.test(email) || email.length > 254)
    return { status: "error", message: "Revisá el email: no parece válido." };
  if (!/^[+0-9()\-\s]{6,25}$/.test(phone))
    return { status: "error", message: "Revisá el teléfono: usá números, espacios o «+»." };
  if (password.length < 8)
    return { status: "error", message: "La contraseña debe tener al menos 8 caracteres." };
  if (!acceptTerms || !acceptResponsibility)
    return {
      status: "error",
      message: "Necesitamos que aceptes los términos y la responsabilidad como residencia.",
    };

  const admin = getSupabaseAdmin();
  if (!admin)
    return {
      status: "error",
      message: "El registro no está disponible en este momento. Probá más tarde.",
    };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { responsible_name: responsibleName },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return {
        status: "error",
        message: "Ya existe una cuenta con ese email. Podés iniciar sesión.",
      };
    }
    console.error("[register-residence] createUser failed:", createError?.message);
    return {
      status: "error",
      message: "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.",
    };
  }

  const userId = created.user.id;
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerStore.get("user-agent");
  let residenceId: string | null = null;

  try {
    const { error: userError } = await admin.from("users").insert({
      id: userId,
      email,
      phone,
      primary_role: "residence_owner",
    });
    if (userError) throw userError;

    // Slug único: nombre normalizado + sufijo corto contra colisiones.
    const baseSlug = slugify(residenceName) || "residencia";
    const slug = `${baseSlug}-${userId.slice(0, 6)}`;

    const { data: residence, error: residenceError } = await admin
      .from("residences")
      .insert({
        name: residenceName,
        slug,
        property_type: propertyType,
        public_area: zone,
        address_line: addressLine,
        city: "CABA",
        responsible_name: responsibleName,
        responsible_contact: phone,
        created_by: userId,
      })
      .select("id")
      .single();
    if (residenceError || !residence) throw residenceError;
    residenceId = residence.id;

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: userId,
      role: "residence_owner",
      scope_type: "residence",
      scope_id: residenceId,
    });
    if (roleError) throw roleError;

    const { error: residenceUserError } = await admin.from("residence_users").insert({
      residence_id: residenceId,
      user_id: userId,
      role: "owner",
    });
    if (residenceUserError) throw residenceUserError;

    const { error: verificationError } = await admin
      .from("residence_verifications")
      .insert({ residence_id: residenceId, status: "not_started" });
    if (verificationError) throw verificationError;

    const consentBase = {
      user_id: userId,
      version: CONSENT_VERSION,
      ip_address: ip,
      user_agent: userAgent,
      related_entity_type: "residences",
      related_entity_id: residenceId,
    };
    const { error: consentError } = await admin.from("consents").insert([
      { ...consentBase, consent_type: "terms", metadata: {} },
      { ...consentBase, consent_type: "residence_responsibility", metadata: {} },
    ]);
    if (consentError) throw consentError;

    await createAuditLog(admin, {
      actorUserId: userId,
      actorRole: "residence_owner",
      action: "residence_registered",
      entityType: "residences",
      entityId: residenceId,
      newValue: { name: residenceName, zone, property_type: propertyType },
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    console.error("[register-residence] rollback, insert failed:", error);
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
  redirect(`/residence/${residenceId}/profile`);
}
