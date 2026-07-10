import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { recordFamilyProposalResponse } from "@/lib/applications/recordFamilyProposalResponse";

/**
 * Extraída del server action `respondFamilyProposal` (Ciclo 21,
 * GAPS.md — mismo patrón aplicado a `markResidencePaymentReceived`/
 * `markFeePaidManually` en el Ciclo 20 y `respondNegotiationProposal`
 * en este mismo ciclo). Reusa el vínculo familiar real Martín↔Lucía
 * del dataset demo (activo desde el fix del Ciclo 15) en vez de crear
 * uno propio — es de solo lectura, no lo modifica.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("recordFamilyProposalResponse (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let familyLinkId: string;

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
    studentUserId = studentUser!.id;

    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("user_id", studentUserId)
      .single();
    studentProfileId = studentProfile!.id;

    const { data: link } = await admin
      .from("family_links")
      .select("id")
      .eq("student_profile_id", studentProfileId)
      .eq("status", "active")
      .single();
    familyLinkId = link!.id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 21 — propuesta familiar)",
        slug: `residencia-test-propuesta-familiar-${Date.now()}`,
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
  });

  afterAll(async () => {
    if (!admin) return;
    // Red de seguridad: si algún test dejó una solicitud sin limpiar
    // (ej. una aserción falló antes de llegar a la limpieza), borrarla
    // acá para no dejar el `residences.delete()` bloqueado por FK ni
    // inflar el conteo de "solicitudes activas" del estudiante real.
    await admin.from("application_requests").delete().eq("residence_id", residenceId);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  async function createFixtureProposal() {
    const { data: familyLink } = await admin
      .from("family_links")
      .select("family_member_id")
      .eq("id", familyLinkId)
      .single();

    const { data: proposal } = await admin
      .from("family_application_proposals")
      .insert({
        family_link_id: familyLinkId,
        family_member_id: familyLink!.family_member_id,
        student_profile_id: studentProfileId,
        residence_id: residenceId,
        room_type_id: roomTypeId,
        desired_start_date: "2026-08-15",
        initial_duration_months: 6,
        message_to_student: "Te propongo esta, queda cerca de todo.",
      })
      .select("id")
      .single();
    return proposal!.id;
  }

  it("rechaza si el actor no tiene perfil de estudiante", async () => {
    const proposalId = await createFixtureProposal();
    const result = await recordFamilyProposalResponse(admin, {
      proposalId,
      decision: "reject",
      actorUserId: ownerId, // dueño de residencia, no tiene student_profile
      rejectionReason: null,
      academicObjective: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/perfil de estudiante/i);

    await admin.from("family_application_proposals").delete().eq("id", proposalId);
  });

  it("registra el rechazo con motivo, sin crear ninguna solicitud", async () => {
    const proposalId = await createFixtureProposal();

    const result = await recordFamilyProposalResponse(admin, {
      proposalId,
      decision: "reject",
      actorUserId: studentUserId,
      rejectionReason: "Prefiero seguir buscando otras opciones.",
      academicObjective: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.applicationId).toBeNull();

    const { data: proposal } = await admin
      .from("family_application_proposals")
      .select("status, rejection_reason, converted_to_application_id")
      .eq("id", proposalId)
      .single();
    expect(proposal!.status).toBe("rejected_by_student");
    expect(proposal!.rejection_reason).toBe("Prefiero seguir buscando otras opciones.");
    expect(proposal!.converted_to_application_id).toBeNull();

    await admin.from("family_application_proposals").delete().eq("id", proposalId);
  });

  it("rechaza aprobar sin un objetivo académico suficiente", async () => {
    const proposalId = await createFixtureProposal();

    const result = await recordFamilyProposalResponse(admin, {
      proposalId,
      decision: "approve",
      actorUserId: studentUserId,
      rejectionReason: null,
      academicObjective: "Corto",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/objetivo académico/i);

    await admin.from("family_application_proposals").delete().eq("id", proposalId);
  });

  it("aprueba la propuesta: crea la solicitud real con contact_target=family_member", async () => {
    const proposalId = await createFixtureProposal();

    try {
      const result = await recordFamilyProposalResponse(admin, {
        proposalId,
        decision: "approve",
        actorUserId: studentUserId,
        rejectionReason: null,
        academicObjective: "Estudiar Ingeniería en la UTN, sede Buenos Aires.",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.applicationId).not.toBeNull();

      const { data: application } = await admin
        .from("application_requests")
        .select("initiated_by, contact_target, family_link_id, family_proposal_id, snapshot_original_id, status")
        .eq("id", result.applicationId!)
        .single();
      expect(application!.initiated_by).toBe("family_member");
      expect(application!.contact_target).toBe("family_member");
      expect(application!.family_link_id).toBe(familyLinkId);
      expect(application!.family_proposal_id).toBe(proposalId);
      expect(application!.status).toBe("submitted");

      const { data: proposal } = await admin
        .from("family_application_proposals")
        .select("status, converted_to_application_id")
        .eq("id", proposalId)
        .single();
      expect(proposal!.status).toBe("approved_by_student");
      expect(proposal!.converted_to_application_id).toBe(result.applicationId);

      // FK circular (mismo patrón documentado varias veces en MEMORY.md):
      // application_requests.family_proposal_id ↔
      // family_application_proposals.converted_to_application_id, ninguna
      // con cascada. Hay que anular un lado antes de poder borrar el otro
      // — acá anulamos `converted_to_application_id` primero. Recién
      // entonces `application_requests` se puede borrar (lo que además
      // cascadea su propio `application_snapshots`, migración 0007).
      await admin.from("family_application_proposals").update({ converted_to_application_id: null }).eq("id", proposalId);
      const { error: deleteAppError } = await admin.from("application_requests").delete().eq("id", result.applicationId!);
      if (deleteAppError) console.error("[test cleanup] delete application_requests failed:", deleteAppError);
    } finally {
      await admin.from("family_application_proposals").delete().eq("id", proposalId);
    }
  });
});
