import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { saveFamilyProfile } from "@/lib/family/updateFamilyProfile";
import type { FamilyProfileInput } from "@/lib/family/familyProfile";

/**
 * Ciclo 61 (DR4) — guarda el perfil propio del familiar. Necesita las columnas `billing_*` de la migración 0045: si todavía
 * no está aplicada en estured-dev, los casos que escriben se saltean (el resto del ciclo no depende de ellas).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("saveFamilyProfile (integración)", () => {
  let admin: SupabaseClient;
  let martinUserId: string;
  let luciaUserId: string;
  let migrationApplied = false;
  let original: { first_name: string; last_name: string; phone: string | null; relationship_type: string } | null = null;

  const input: FamilyProfileInput = {
    firstName: "Martin",
    lastName: "Fernandez",
    phone: "+54 9 341 555-0104",
    relationshipType: "padre",
    billingTaxId: "20123456786",
    billingVatCondition: "monotributista",
  };

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    martinUserId = (await admin.from("users").select("id").eq("email", "padre.lucia@example.com").single()).data!.id;
    luciaUserId = (await admin.from("users").select("id").eq("email", "lucia.fernandez@example.com").single()).data!.id;
    const probe = await admin.from("family_members").select("billing_tax_id").limit(1);
    migrationApplied = !probe.error;
    original = (
      await admin.from("family_members").select("first_name, last_name, phone, relationship_type").eq("user_id", martinUserId).single()
    ).data;
  });

  it("un usuario que no es familiar no tiene perfil para editar", async () => {
    const result = await saveFamilyProfile(admin, { userId: luciaUserId, input });
    expect(result.ok).toBe(false);
  });

  it("guarda datos de contacto y facturación, y los restaura", async (ctx) => {
    if (!migrationApplied) ctx.skip();
    const result = await saveFamilyProfile(admin, { userId: martinUserId, input: { ...input, billingTaxId: "12345678", billingVatCondition: "consumidor_final" } });
    expect(result).toEqual({ ok: true });
    const { data } = await admin.from("family_members").select("billing_tax_id, billing_vat_condition").eq("user_id", martinUserId).single();
    expect(data).toEqual({ billing_tax_id: "12345678", billing_vat_condition: "consumidor_final" });
    // La base rechaza un CUIT/DNI con formato inválido aunque se salte la validación de la app.
    const bad = await admin.from("family_members").update({ billing_tax_id: "123" }).eq("user_id", martinUserId);
    expect(bad.error).not.toBeNull();
    await saveFamilyProfile(admin, {
      userId: martinUserId,
      input: {
        firstName: original!.first_name,
        lastName: original!.last_name,
        phone: original!.phone ?? "",
        relationshipType: original!.relationship_type === "padre" ? "padre" : "otro",
        billingTaxId: null,
        billingVatCondition: null,
      },
    });
  });
});
