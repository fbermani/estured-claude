"use server";

import { validatePassword } from "@/lib/auth/password";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { formError, type RegisterFormState } from "@/app/(public)/register/formState";
import { PROPERTY_TYPE_OPTIONS, BARRIO_OPTIONS } from "@/lib/residences/options";
import { saveResidencePrivateDetails } from "@/lib/residences/privateDetails";

export type RegisterResidenceState = RegisterFormState;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONSENT_VERSION = "v0.1-borrador";
const PROPERTY_TYPES = new Set(PROPERTY_TYPE_OPTIONS.map((o) => o.value));
const BARRIOS = new Set<string>(BARRIO_OPTIONS);

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
    return formError(formData, "Contanos el nombre del responsable.", "responsible_name");
  if (!residenceName || residenceName.length > 160)
    return formError(formData, "Contanos el nombre de la residencia.", "residence_name");
  if (!PROPERTY_TYPES.has(propertyType as (typeof PROPERTY_TYPE_OPTIONS)[number]["value"]))
    return formError(formData, "Elegí un tipo de propiedad válido.", "property_type");
  if (!BARRIOS.has(zone))
    return formError(formData, "Elegí un barrio de CABA válido.", "zone");
  if (!addressLine || addressLine.length > 200)
    return formError(formData, "Contanos la dirección completa.", "address_line");
  if (!EMAIL_RE.test(email) || email.length > 254)
    return formError(formData, "Revisá el email: no parece válido.", "email");
  if (!/^[+0-9()\-\s]{6,25}$/.test(phone))
    return formError(formData, "Revisá el teléfono: usá números, espacios o «+».", "phone");
  const passwordError = validatePassword(password);
  if (passwordError) return formError(formData, passwordError, "password");
  if (!acceptTerms || !acceptResponsibility)
    return formError(formData, "Necesitamos que aceptes los términos y la responsabilidad como residencia.");

  const admin = getSupabaseAdmin();
  if (!admin)
    return formError(formData, "El registro no está disponible en este momento. Probá más tarde.");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { responsible_name: responsibleName },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return formError(formData, "Ya existe una cuenta con ese email. Podés iniciar sesión.", "email");
    }
    console.error("[register-residence] createUser failed:", createError?.message);
    return formError(formData, "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.");
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
        created_by: userId,
      })
      .select("id")
      .single();
    if (residenceError || !residence) throw residenceError;
    residenceId = residence.id;

    // Ciclo 56: el contacto del responsable es privado (`residence_private_details`, solo service role);
    // `residences` es legible con la anon key.
    const privateError = await saveResidencePrivateDetails(admin, residence.id, {
      responsible_name: responsibleName,
      responsible_contact: phone,
    });
    if (privateError) throw new Error(privateError.message);

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
    return formError(formData, "No pudimos completar el registro. Intentá de nuevo en unos minutos.");
  }

  const supabase = await getSupabaseServer();
  if (supabase) {
    await supabase.auth.signInWithPassword({ email, password });
  }
  redirect(`/residence/${residenceId}/profile`);
}
