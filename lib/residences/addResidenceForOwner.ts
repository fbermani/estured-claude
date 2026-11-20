import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { PROPERTY_TYPE_OPTIONS, BARRIO_OPTIONS } from "@/lib/residences/options";
import { saveResidencePrivateDetails } from "@/lib/residences/privateDetails";
import { geocodeAddress, type Geocoder } from "@/lib/geocoding/nominatim";
import { geocodeResidenceByAdmin } from "@/lib/residences/geocodeResidence";

/** Docs/06 §8.2 / docs/05: un owner gestiona hasta 10 residencias (también lo impone el trigger de la migración 0003). */
export const MAX_RESIDENCES_PER_OWNER = 10;
const CONSENT_VERSION = "v0.1-borrador";
const PROPERTY_TYPES = new Set<string>(PROPERTY_TYPE_OPTIONS.map((o) => o.value));
const BARRIOS = new Set<string>(BARRIO_OPTIONS);

export type AddResidenceResult = { ok: true; residenceId: string } | { ok: false; error: string };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * "Sumar otra residencia" para un owner YA logueado (auditoría 2026-10-20,
 * H22; docs/11 §7.3 `/residence/settings/new`, docs/06 §8.2).
 *
 * Reutiliza el andamiaje del alta (`registerResidence`) sin crear cuenta: la
 * residencia nace en `draft` con `operating_mode='verified_profile'` (Gestión
 * Operativa se otorga por admin, nunca se autoselecciona), con el usuario
 * como owner activo, su verificación `not_started`, el consentimiento de
 * responsabilidad registrado y la acción auditada. Los datos de contacto
 * del responsable se heredan de su residencia más reciente;
 * después los edita en el perfil.
 *
 * Toda la validación es server-side. El límite de 10 se chequea acá para dar
 * un mensaje claro y además lo impone el trigger como barrera dura. Si algo
 * falla a mitad se deshace lo ya creado (mismo criterio que el alta).
 *
 * La autorización (que `ownerUserId` sea el de la sesión) es responsabilidad de
 * quien llama — la server action usa `getSessionUser()`.
 */
export async function addResidenceForOwner(
  admin: SupabaseClient,
  params: {
    ownerUserId: string;
    residenceName: string;
    propertyType: string;
    zone: string;
    addressLine: string;
    acceptResponsibility: boolean;
    slugPrefix?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    /** Inyectable para tests; por defecto Nominatim (en NODE_ENV=test no se llama a la red). */
    geocoder?: Geocoder;
  },
): Promise<AddResidenceResult> {
  const residenceName = params.residenceName.trim();
  const addressLine = params.addressLine.trim();

  if (!residenceName || residenceName.length > 160)
    return { ok: false, error: "Contanos el nombre de la residencia." };
  if (!PROPERTY_TYPES.has(params.propertyType)) return { ok: false, error: "Elegí un tipo de propiedad válido." };
  if (!BARRIOS.has(params.zone)) return { ok: false, error: "Elegí un barrio de CABA válido." };
  if (!addressLine || addressLine.length > 200) return { ok: false, error: "Contanos la dirección completa." };
  if (!params.acceptResponsibility)
    return { ok: false, error: "Necesitamos que confirmes que sos responsable de la información que cargues." };

  // Solo un owner activo puede sumar residencias (el staff no).
  const { data: owned, error: ownedError } = await admin
    .from("residence_users")
    .select("residence_id")
    .eq("user_id", params.ownerUserId)
    .eq("role", "owner")
    .eq("is_active", true);
  if (ownedError) {
    console.error("[add-residence] owner lookup failed:", ownedError.message);
    return { ok: false, error: "No pudimos verificar tu cuenta. Intentá de nuevo en unos minutos." };
  }
  if (!owned || owned.length === 0)
    return { ok: false, error: "Solo el responsable (owner) de una residencia puede sumar otra." };
  if (owned.length >= MAX_RESIDENCES_PER_OWNER)
    return { ok: false, error: `Llegaste al máximo de ${MAX_RESIDENCES_PER_OWNER} residencias por cuenta.` };

  // Contacto del responsable: nombre y teléfono de su residencia más reciente (el teléfono, si falta, el de su usuario).
  const ownedIds = owned.map((o) => o.residence_id as string);
  // Ciclo 56: el responsable vive en `residence_private_details` (privado, solo service role).
  const { data: latest } = await admin
    .from("residence_private_details")
    .select("responsible_name, responsible_contact")
    .in("residence_id", ownedIds)
    .not("responsible_name", "is", null)
    .not("responsible_contact", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: ownerUser } = await admin.from("users").select("phone").eq("id", params.ownerUserId).maybeSingle();
  // Nunca se usa el email como nombre del responsable: si falta, se pide que lo completen.
  const responsibleName = latest?.responsible_name;
  const responsibleContact = latest?.responsible_contact ?? ownerUser?.phone;
  if (!responsibleName || !responsibleContact)
    return {
      ok: false,
      error:
        "Completá el contacto del responsable (nombre y teléfono) en el perfil de tu residencia actual y volvé a intentar.",
    };

  const slug = `${params.slugPrefix ?? ""}${slugify(residenceName) || "residencia"}-${params.ownerUserId.slice(0, 6)}-${crypto
    .randomUUID()
    .slice(0, 6)}`;

  let residenceId: string | null = null;
  try {
    const { data: residence, error: residenceError } = await admin
      .from("residences")
      .insert({
        name: residenceName,
        slug,
        property_type: params.propertyType,
        public_area: params.zone,
        address_line: addressLine,
        city: "CABA",
        status: "draft",
        operating_mode: "verified_profile",
        created_by: params.ownerUserId,
      })
      .select("id")
      .single();
    if (residenceError || !residence) throw residenceError ?? new Error("residence insert sin fila");
    residenceId = residence.id as string;

    // Ciclo 56: el contacto del responsable es privado (`residence_private_details`, solo service role).
    const privateError = await saveResidencePrivateDetails(admin, residenceId, {
      responsible_name: responsibleName,
      responsible_contact: responsibleContact,
    });
    if (privateError) throw new Error(privateError.message);

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: params.ownerUserId,
      role: "residence_owner",
      scope_type: "residence",
      scope_id: residenceId,
    });
    if (roleError) throw roleError;

    // El trigger `enforce_owner_residence_limit` es la barrera dura del tope de 10.
    const { error: residenceUserError } = await admin
      .from("residence_users")
      .insert({ residence_id: residenceId, user_id: params.ownerUserId, role: "owner" });
    if (residenceUserError) throw residenceUserError;

    const { error: verificationError } = await admin
      .from("residence_verifications")
      .insert({ residence_id: residenceId, status: "not_started" });
    if (verificationError) throw verificationError;

    const { error: consentError } = await admin.from("consents").insert({
      user_id: params.ownerUserId,
      consent_type: "residence_responsibility",
      version: CONSENT_VERSION,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      related_entity_type: "residences",
      related_entity_id: residenceId,
      metadata: {},
    });
    if (consentError) throw consentError;

    await createAuditLog(admin, {
      actorUserId: params.ownerUserId,
      actorRole: "residence_owner",
      action: "residence_registered",
      entityType: "residences",
      entityId: residenceId,
      newValue: {
        name: residenceName,
        zone: params.zone,
        property_type: params.propertyType,
        additional_residence: true,
      },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (error) {
    console.error("[add-residence] rollback, insert failed:", error);
    if (residenceId) {
      // El rollback no debe fallar en silencio: cada paso se chequea y se loguea.
      const logFailure = (step: string, rollbackError: { message: string } | null) => {
        if (rollbackError) console.error(`[add-residence] rollback (${step}) failed:`, rollbackError.message);
      };
      const { error: consentsError } = await admin
        .from("consents")
        .delete()
        .eq("related_entity_id", residenceId)
        .eq("consent_type", "residence_responsibility");
      logFailure("consents", consentsError);
      const { error: rolesError } = await admin
        .from("user_roles")
        .delete()
        .eq("scope_type", "residence")
        .eq("scope_id", residenceId)
        .eq("user_id", params.ownerUserId);
      logFailure("user_roles", rolesError);
      // residence_users y residence_verifications caen por ON DELETE CASCADE.
      const { error: residenceDeleteError } = await admin.from("residences").delete().eq("id", residenceId);
      logFailure("residences", residenceDeleteError);
    }
    const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
    if (message.includes("más de 10 residencias"))
      return { ok: false, error: `Llegaste al máximo de ${MAX_RESIDENCES_PER_OWNER} residencias por cuenta.` };
    return { ok: false, error: "No pudimos crear la residencia. Intentá de nuevo en unos minutos." };
  }

  // DF6: identifica la coordenada desde la dirección. Mejor esfuerzo: si falla, la residencia queda sin pin
  // (la ficha cae al centro del barrio) y el admin puede usar «Ubicar desde la dirección».
  try {
    await geocodeResidenceByAdmin(
      admin,
      { residenceId, actorUserId: params.ownerUserId, actorRole: "residence_owner" },
      params.geocoder ?? (process.env.NODE_ENV === "test" ? async () => null : geocodeAddress),
    );
  } catch (error) {
    console.error("[add-residence] geocodificación falló:", error);
  }

  return { ok: true, residenceId };
}
