import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expireResidenceVerifications } from "@/lib/jobs/expireResidenceVerifications";

/**
 * Job de vencimiento de verificación anual (docs/12 §18 Fase 12,
 * docs/19, Ciclo 34unodevicies-quinquies). El job corre sobre TODAS las
 * residencias con verificación vencida, no solo la de este fixture —
 * `expiredCount` se chequea con `toBeGreaterThanOrEqual`.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("expireResidenceVerifications (integración)", () => {
  let admin: SupabaseClient;
  let staleResidenceId: string;
  let staleVerificationId: string;
  let freshResidenceId: string;
  let freshVerificationId: string;
  let ownerId: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;

    async function createResidenceWithVerification(nameSuffix: string, expiresAt: string) {
      const { data: residence, error } = await admin
        .from("residences")
        .insert({
          name: `Residencia Test Integración (Ciclo 34unodevicies-sexies — verificación ${nameSuffix})`,
          slug: `residencia-test-expire-verification-${nameSuffix}-${Date.now()}`,
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
      if (error) throw error;

      await admin.from("residence_users").insert({ residence_id: residence!.id, user_id: ownerId, role: "owner", is_active: true });

      const { data: verification } = await admin
        .from("residence_verifications")
        .insert({
          residence_id: residence!.id,
          status: "approved",
          responsible_identity_checked: true,
          coordinator_identity_checked: true,
          address_checked: true,
          photos_match_reality: true,
          approved_at: new Date().toISOString(),
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      return { residenceId: residence!.id, verificationId: verification!.id };
    }

    const stale = await createResidenceWithVerification("vencida", "2020-01-01T00:00:00Z");
    staleResidenceId = stale.residenceId;
    staleVerificationId = stale.verificationId;

    const fresh = await createResidenceWithVerification("vigente", "2099-01-01T00:00:00Z");
    freshResidenceId = fresh.residenceId;
    freshVerificationId = fresh.verificationId;
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of [staleResidenceId, freshResidenceId]) {
      await admin.from("notifications").delete().eq("related_entity_id", id);
      await admin.from("residence_verifications").delete().eq("residence_id", id);
      await admin.from("residence_users").delete().eq("residence_id", id);
      const { error } = await admin.from("residences").delete().eq("id", id);
      if (error) console.error("[test cleanup] delete residence failed:", error);
    }
  });

  it("vence la residencia con verificación pasada, deja intacta la vigente, audita y notifica", async () => {
    const result = await expireResidenceVerifications(admin);
    expect(result.expiredCount).toBeGreaterThanOrEqual(1);

    const { data: stale } = await admin.from("residences").select("status").eq("id", staleResidenceId).single();
    expect(stale?.status).toBe("verification_expired");

    const { data: staleVerification } = await admin
      .from("residence_verifications")
      .select("status")
      .eq("id", staleVerificationId)
      .single();
    expect(staleVerification?.status).toBe("expired");

    const { data: fresh } = await admin.from("residences").select("status").eq("id", freshResidenceId).single();
    expect(fresh?.status).toBe("verified_active");

    const { data: freshVerification } = await admin
      .from("residence_verifications")
      .select("status")
      .eq("id", freshVerificationId)
      .single();
    expect(freshVerification?.status).toBe("approved");

    const { data: log } = await admin
      .from("audit_logs")
      .select("id")
      .eq("entity_type", "residences")
      .eq("entity_id", staleResidenceId)
      .eq("action", "residence_verification_expired")
      .maybeSingle();
    expect(log).not.toBeNull();

    const { data: notification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", staleResidenceId)
      .eq("title", "La verificación anual de tu residencia venció")
      .maybeSingle();
    expect(notification).not.toBeNull();
  });
});
