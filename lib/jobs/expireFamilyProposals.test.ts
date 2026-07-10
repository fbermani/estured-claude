import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expireFamilyProposals } from "@/lib/jobs/expireFamilyProposals";

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("expireFamilyProposals (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentProfileId: string;
  let familyLinkId: string;
  let familyMemberId: string;
  let staleProposalId: string;
  let freshProposalId: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin
      .from("users")
      .select("id")
      .eq("email", "owner.residencia.norte@example.com")
      .single();
    ownerId = owner!.id;

    const { data: studentUser } = await admin
      .from("users")
      .select("id")
      .eq("email", "lucia.fernandez@example.com")
      .single();
    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("user_id", studentUser!.id)
      .single();
    studentProfileId = studentProfile!.id;

    const { data: link } = await admin
      .from("family_links")
      .select("id, family_member_id")
      .eq("student_profile_id", studentProfileId)
      .eq("status", "active")
      .single();
    familyLinkId = link!.id;
    familyMemberId = link!.family_member_id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 22 — expire family proposals)",
        slug: `residencia-test-expire-family-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        responsible_name: "Test",
        responsible_contact: "+54 9 11 0000-0000",
        total_capacity: 5,
        created_by: ownerId,
      })
      .select("id")
      .single();
    residenceId = residence!.id;

    const { data: roomType } = await admin
      .from("room_types")
      .insert({
        residence_id: residenceId,
        name: "Individual",
        monthly_price_usd: 300,
        monthly_price_ars: 456000,
        adjustment_policy: "quarterly",
        is_active: true,
      })
      .select("id")
      .single();
    roomTypeId = roomType!.id;

    const staleExpiry = new Date(Date.now() - 3 * 3_600_000).toISOString(); // venció hace 3h
    const freshExpiry = new Date(Date.now() + 48 * 3_600_000).toISOString();

    const { data: staleProposal } = await admin
      .from("family_application_proposals")
      .insert({
        family_link_id: familyLinkId,
        family_member_id: familyMemberId,
        student_profile_id: studentProfileId,
        residence_id: residenceId,
        room_type_id: roomTypeId,
        desired_start_date: "2026-08-15",
        initial_duration_months: 6,
        expires_at: staleExpiry,
      })
      .select("id")
      .single();
    staleProposalId = staleProposal!.id;

    const { data: freshProposal } = await admin
      .from("family_application_proposals")
      .insert({
        family_link_id: familyLinkId,
        family_member_id: familyMemberId,
        student_profile_id: studentProfileId,
        residence_id: residenceId,
        room_type_id: roomTypeId,
        desired_start_date: "2026-08-15",
        initial_duration_months: 6,
        expires_at: freshExpiry,
      })
      .select("id")
      .single();
    freshProposalId = freshProposal!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("family_application_proposals").delete().in("id", [staleProposalId, freshProposalId]);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  it("vence solo las propuestas pendientes con expires_at pasado, deja intactas las vigentes", async () => {
    const result = await expireFamilyProposals(admin);
    expect(result.expiredCount).toBeGreaterThanOrEqual(1);

    const { data: stale } = await admin
      .from("family_application_proposals")
      .select("status")
      .eq("id", staleProposalId)
      .single();
    expect(stale!.status).toBe("expired");

    const { data: fresh } = await admin
      .from("family_application_proposals")
      .select("status")
      .eq("id", freshProposalId)
      .single();
    expect(fresh!.status).toBe("pending_student_approval");
  });
});
