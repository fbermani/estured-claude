import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import type { FamilyProfileInput } from "@/lib/family/familyProfile";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

export type UpdateFamilyProfileResult =
  | { ok: true; /** Hubo que dejar afuera algo (migración 0045 sin aplicar): se guardó el resto. */ warning?: string }
  | { ok: false; error: string };

const GENERIC_ERROR = "No pudimos guardar tus datos. Probá de nuevo en unos minutos.";
const BILLING_PENDING_WARNING =
  "Guardamos tus datos de contacto; los datos de facturación se podrán guardar cuando se actualice el sistema.";

type DbError = { code?: string | null; message?: string | null } | null;

/**
 * Guarda el perfil propio del familiar (DR4). La validación ya se hizo con `parseFamilyProfileInput`; acá se verifica que
 * el usuario SEA familiar (tenga `family_members`) y se escribe con service role: `family_members` es solo lectura para la
 * API (migración 0045). La escritura es robusta a la migración 0045 sin aplicar: primero los datos de contacto (que no
 * dependen de ella), después `users.phone` (con reversión si falla, para no desincronizar) y al final la facturación; si
 * las columnas `billing_*` no existen, se avisa y se conserva lo demás. Lo mismo con `otro` (se guarda como `familiar`,
 * su equivalente). Los datos de facturación nunca van al log de auditoría (solo qué campos cambiaron).
 */
export async function saveFamilyProfile(
  admin: SupabaseClient,
  params: { userId: string; input: FamilyProfileInput },
): Promise<UpdateFamilyProfileResult> {
  const { input } = params;
  const { data: member, error: readError } = await admin
    .from("family_members")
    .select("id, first_name, last_name, phone, relationship_type")
    .eq("user_id", params.userId)
    .maybeSingle();
  if (readError) {
    console.error("[family] read profile failed:", readError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!member) return { ok: false, error: "No encontramos tu perfil de familiar." };

  const base = { first_name: input.firstName, last_name: input.lastName, phone: input.phone };
  let relationship: string = input.relationshipType;
  let baseResult: { error: DbError } = await admin
    .from("family_members")
    .update({ ...base, relationship_type: relationship })
    .eq("id", member.id);
  if (baseResult.error && relationship === "otro") {
    // CHECK anterior a la 0045: `otro` todavía no existe y `familiar` es su equivalente (docs/06 §6.3).
    relationship = "familiar";
    baseResult = await admin
      .from("family_members")
      .update({ ...base, relationship_type: relationship })
      .eq("id", member.id);
  }
  if (baseResult.error) {
    console.error("[family] update profile failed:", baseResult.error);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error: userPhoneError } = await admin.from("users").update({ phone: input.phone }).eq("id", params.userId);
  if (userPhoneError) {
    console.error("[family] update users.phone failed:", userPhoneError);
    // Reversión (mejor esfuerzo) para que `users` y `family_members` no queden con teléfonos distintos.
    const { error: revertError } = await admin
      .from("family_members")
      .update({
        first_name: member.first_name,
        last_name: member.last_name,
        phone: member.phone,
        relationship_type: member.relationship_type,
      })
      .eq("id", member.id);
    if (revertError) console.error("[family] revert profile failed:", revertError);
    return { ok: false, error: GENERIC_ERROR };
  }

  let warning: string | undefined;
  const { error: billingError } = await admin
    .from("family_members")
    .update({ billing_tax_id: input.billingTaxId, billing_vat_condition: input.billingVatCondition })
    .eq("id", member.id);
  if (billingError) {
    if (isMissingSchemaError(billingError)) {
      warning = BILLING_PENDING_WARNING;
    } else {
      console.error("[family] update billing failed:", billingError);
      return { ok: false, error: "Guardamos tus datos de contacto, pero no pudimos guardar los de facturación. Probá de nuevo." };
    }
  }

  const changed = [
    member.first_name !== input.firstName || member.last_name !== input.lastName ? "name" : null,
    member.phone !== input.phone ? "phone" : null,
    member.relationship_type !== relationship ? "relationship" : null,
    warning ? null : "billing",
  ].filter(Boolean);
  await createAuditLog(admin, {
    actorUserId: params.userId,
    actorRole: "family_member",
    action: "family_profile_updated",
    entityType: "family_members",
    entityId: member.id,
    newValue: { fields: changed },
  });
  return warning ? { ok: true, warning } : { ok: true };
}
