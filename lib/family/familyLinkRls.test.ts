import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Ciclo 61 (auditoría de seguridad) — la migración 0046 hace que SOLO un vínculo `active` le dé al familiar acceso a los
 * datos del estudiante. Este test usa la anon key + el JWT del usuario (RLS real, como PostgREST desde el navegador).
 *
 * ⚠ Se ejecuta SOLO después de aplicar `db/migrations/0046_family_link_active_only.sql` en estured-dev:
 *   MIGRATION_0046_APPLIED=1 npx vitest run lib/family/familyLinkRls
 * Antes de aplicarla, este test falla a propósito (es la prueba de que el agujero existe). Con la 0045 aplicada también
 * comprueba que el estudiante no lee `billing_tax_id`/`phone` del familiar.
 */
const enabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.DEMO_USERS_PASSWORD &&
    process.env.MIGRATION_0046_APPLIED === "1",
);

describe.skipIf(!enabled)("RLS del vínculo familiar (integración, requiere 0046)", () => {
  let admin: SupabaseClient;
  let luciaProfileId: string;
  let pendingUserId: string;
  let pendingFamilyMemberId: string;
  let pendingLinkId: string;
  const email = `rls-pending-${Date.now()}@example.com`;
  const password = process.env.DEMO_USERS_PASSWORD ?? "";

  const asUser = async (userEmail: string) => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: userEmail, password });
    if (error) throw error;
    return client;
  };

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const luciaUser = (await admin.from("users").select("id").eq("email", "lucia.fernandez@example.com").single()).data!;
    luciaProfileId = (await admin.from("student_profiles").select("id").eq("user_id", luciaUser.id).single()).data!.id;

    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !created.user) throw error;
    pendingUserId = created.user.id;
    await admin.from("users").insert({ id: pendingUserId, email, phone: "+54 11 5555-0000", primary_role: "family_member" });
    await admin.from("user_roles").insert({ user_id: pendingUserId, role: "family_member", scope_type: "global" });
    const { data: fm } = await admin
      .from("family_members")
      .insert({ user_id: pendingUserId, first_name: "Pendiente", last_name: "Test", relationship_type: "tutor", phone: "+54 11 5555-0000" })
      .select("id")
      .single();
    pendingFamilyMemberId = fm!.id;
    // El estudiante ya tiene un familiar activo (Martín): el vínculo de prueba entra como rechazado/revocado, que no choca con el índice único.
    const { data: link } = await admin
      .from("family_links")
      .insert({ student_profile_id: luciaProfileId, family_member_id: pendingFamilyMemberId, status: "revoked_by_student", requested_by_user_id: pendingUserId })
      .select("id")
      .single();
    pendingLinkId = link!.id;
  });

  afterAll(async () => {
    if (!admin || !pendingUserId) return;
    await admin.from("family_links").delete().eq("id", pendingLinkId);
    await admin.from("family_members").delete().eq("id", pendingFamilyMemberId);
    await admin.from("user_roles").delete().eq("user_id", pendingUserId);
    await admin.from("users").delete().eq("id", pendingUserId);
    await admin.auth.admin.deleteUser(pendingUserId);
  });

  const tables = ["student_profiles", "application_requests", "reservations", "estured_fee_payments", "booking_receipts", "waitlist_entries", "resident_stays", "student_favorites"];

  it("un familiar con vínculo NO activo no lee ninguna fila del estudiante con la anon key + su JWT", async () => {
    const client = await asUser(email);
    for (const table of tables) {
      const column = table === "student_profiles" ? "id" : table === "estured_fee_payments" ? "beneficiary_student_profile_id" : "student_profile_id";
      const { data, error } = await client.from(table).select("id").eq(column, luciaProfileId);
      expect(error, table).toBeNull();
      expect(data, `fuga en ${table}`).toEqual([]);
    }
  });

  it("control: Martín (vínculo ACTIVO) sí ve los datos de su estudiante", async () => {
    const client = await asUser("padre.lucia@example.com");
    const { data } = await client.from("student_profiles").select("id").eq("id", luciaProfileId);
    expect(data).toHaveLength(1);
    const { data: apps } = await client.from("application_requests").select("id").eq("student_profile_id", luciaProfileId);
    expect((apps ?? []).length).toBeGreaterThan(0);
  });

  it("el estudiante lee el nombre del familiar de su vínculo ACTIVO pero no su teléfono ni facturación (0045)", async () => {
    const client = await asUser("lucia.fernandez@example.com");
    const { data, error } = await client.from("family_members").select("first_name, last_name, relationship_type");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    // Un vínculo revocado ya no expone al familiar al estudiante.
    const { data: revoked } = await client.from("family_members").select("id").eq("id", pendingFamilyMemberId);
    expect(revoked).toEqual([]);
    const sensitive = await client.from("family_members").select("phone");
    const billing = await client.from("family_members").select("billing_tax_id");
    expect(sensitive.error).not.toBeNull();
    expect(billing.error).not.toBeNull();
  });
});
