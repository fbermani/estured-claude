import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const family = vi.hoisted(() => ({ value: null as null | { userId: string; name: string; permissions: Record<string, unknown> } }));
vi.mock("@/lib/family/access", () => ({ loadActiveFamilyOfStudent: async () => family.value }));
vi.mock("@/lib/applications/collectionChoiceDb", () => ({ loadCollectionChoice: async () => ({ kind: "missing" }) }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { decidePaymentActor, resolvePaymentActor } from "@/lib/applications/studentPaymentAccess";
import { loadStudentPaymentCard, splitInstructionsSnapshot } from "@/lib/applications/loadStudentPaymentCard";

/**
 * DR63 (j) 3 y (m): quién lee los datos de cobro congelados. Estudiante de la solicitud: sí. Familiar pagador de un MENOR: sí.
 * Otro estudiante, familiar de un adulto, dueño o staff de la residencia: no. Se deriva de la base, no de roles de sesión.
 */
const SNAPSHOT = "Transferencia en pesos\nAlias: casa.norte CBU 0170099220000067797370";

function world(app: Row = {}, payment: Row = {}): Record<string, Row[]> {
  return {
    application_requests: [
      {
        id: "app-1",
        status: "residence_payment_pending",
        residence_id: "res-1",
        student_profile_id: "sp-1",
        contact_target: "student",
        collection_mode: "enabled_methods",
        payment_deadline_at: "2030-01-01T00:00:00.000Z",
        ...app,
      },
    ],
    student_profiles: [{ id: "sp-1", user_id: "u-student" }],
    external_residence_payments: [
      {
        id: "pay-1",
        application_request_id: "app-1",
        status: "pending",
        chosen_method: "transfer_ars",
        expected_amount_usd: 300,
        expected_amount_ars: 450000,
        instructions_snapshot: SNAPSHOT,
        student_reported_paid_at: null,
        student_proof_file_id: null,
        student_payment_issue_at: null,
        student_payment_issue_resolved_at: null,
        ...payment,
      },
    ],
  };
}

beforeEach(() => {
  family.value = { userId: "u-family", name: "Martín", permissions: { can_pay_estured_fee: true } };
});

describe("decidePaymentActor (pura)", () => {
  const base = { userId: "u", studentUserId: "s", isMinor: false, familyUserId: null as string | null, familyCanPay: undefined as boolean | undefined };
  it("estudiante: sí, aunque sea menor", () => {
    expect(decidePaymentActor({ ...base, userId: "s" })).toBe("student");
    expect(decidePaymentActor({ ...base, userId: "s", isMinor: true })).toBe("student");
  });
  it("familiar de un menor: sí; sin permiso apagado explícito", () => {
    expect(decidePaymentActor({ ...base, isMinor: true, familyUserId: "u" })).toBe("family_payer");
    expect(decidePaymentActor({ ...base, isMinor: true, familyUserId: "u", familyCanPay: true })).toBe("family_payer");
    expect(decidePaymentActor({ ...base, isMinor: true, familyUserId: "u", familyCanPay: false })).toBeNull();
  });
  it("familiar de un adulto, otro usuario o sin sesión: no", () => {
    expect(decidePaymentActor({ ...base, isMinor: false, familyUserId: "u" })).toBeNull();
    expect(decidePaymentActor({ ...base })).toBeNull();
    expect(decidePaymentActor({ ...base, userId: "" })).toBeNull();
  });
});

describe("resolvePaymentActor (base en memoria)", () => {
  it("el estudiante de la solicitud pasa", async () => {
    const { client } = createInMemorySupabase(world());
    expect(await resolvePaymentActor(client, "u-student", "app-1")).toMatchObject({ ok: true, role: "student", isMinor: false });
  });
  it("otro estudiante, el dueño y el staff de la residencia NO pasan", async () => {
    const { client } = createInMemorySupabase(world());
    for (const u of ["u-otro-estudiante", "ricardo-owner", "staff-con-todos-los-permisos"]) {
      expect(await resolvePaymentActor(client, u, "app-1")).toEqual({ ok: false, reason: "not_allowed" });
    }
  });
  it("el familiar de un MENOR pasa como pagador; el de un adulto no", async () => {
    const minor = createInMemorySupabase(world({ contact_target: "family_member" }));
    expect(await resolvePaymentActor(minor.client, "u-family", "app-1")).toMatchObject({ ok: true, role: "family_payer", isMinor: true });
    const adult = createInMemorySupabase(world({ contact_target: "student" }));
    expect(await resolvePaymentActor(adult.client, "u-family", "app-1")).toEqual({ ok: false, reason: "not_allowed" });
  });
  it("familiar sin vínculo activo o con el permiso apagado: no", async () => {
    const { client } = createInMemorySupabase(world({ contact_target: "family_member" }));
    family.value = null;
    expect(await resolvePaymentActor(client, "u-family", "app-1")).toEqual({ ok: false, reason: "not_allowed" });
    family.value = { userId: "u-family", name: "M", permissions: { can_pay_estured_fee: false } };
    expect(await resolvePaymentActor(client, "u-family", "app-1")).toEqual({ ok: false, reason: "not_allowed" });
  });
  it("solicitud inexistente", async () => {
    const { client } = createInMemorySupabase(world());
    expect(await resolvePaymentActor(client, "u-student", "nope")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("loadStudentPaymentCard: los datos de cobro solo llegan a quien corresponde", () => {
  it("el estudiante ve los datos, el monto congelado y el plazo", async () => {
    const { client } = createInMemorySupabase(world());
    const view = await loadStudentPaymentCard(client, { userId: "u-student", applicationId: "app-1" });
    expect(view).toMatchObject({
      kind: "enabled_methods",
      stage: "to_pay",
      methodLabel: "Transferencia en pesos",
      instructions: "Alias: casa.norte CBU 0170099220000067797370",
      amountUsd: 300,
      amountArs: 450000,
      deadlineAt: "2030-01-01T00:00:00.000Z",
    });
  });
  it("el familiar pagador de un menor ve los datos", async () => {
    const { client } = createInMemorySupabase(world({ contact_target: "family_member" }));
    const view = await loadStudentPaymentCard(client, { userId: "u-family", applicationId: "app-1" });
    expect(view).toMatchObject({ kind: "enabled_methods", actorRole: "family_payer", isMinor: true });
    expect(view && view.kind === "enabled_methods" ? view.instructions : null).toContain("CBU");
  });
  it("otro estudiante, familiar de un adulto, dueño y staff: null (nada que serializar)", async () => {
    const { client } = createInMemorySupabase(world());
    for (const u of ["u-otro", "u-family", "ricardo-owner", "staff-pagos"]) {
      expect(await loadStudentPaymentCard(client, { userId: u, applicationId: "app-1" })).toBeNull();
    }
  });
  it("fuera de residence_payment_pending: null", async () => {
    const { client } = createInMemorySupabase(world({ status: "converted_to_reservation" }));
    expect(await loadStudentPaymentCard(client, { userId: "u-student", applicationId: "app-1" })).toBeNull();
  });
  it("contacto directo: solo el mensaje, sin datos de cobro ni número", async () => {
    const { client } = createInMemorySupabase(world({ collection_mode: "whatsapp_direct" }));
    const view = await loadStudentPaymentCard(client, { userId: "u-student", applicationId: "app-1" });
    expect(view).toEqual({ kind: "whatsapp_direct", actorRole: "student", isMinor: false });
    expect(JSON.stringify(view)).not.toContain("CBU");
  });
  it("sin camino definido y sin configuración legible: se trata como contacto directo (solicitud anterior a DR63)", async () => {
    const { client } = createInMemorySupabase(world({ collection_mode: null }));
    expect(await loadStudentPaymentCard(client, { userId: "u-student", applicationId: "app-1" })).toMatchObject({ kind: "whatsapp_direct" });
  });
  it("tras «Ya pagué», con aviso abierto o en disputa: no se vuelven a mostrar los datos", async () => {
    for (const payment of [
      { status: "student_reported_paid", student_reported_paid_at: "2026-11-20T10:00:00Z" },
      { student_payment_issue_at: "2026-11-20T10:00:00Z" },
      { status: "disputed", student_reported_paid_at: "2026-11-20T10:00:00Z" },
    ]) {
      const { client } = createInMemorySupabase(world({}, payment));
      const view = await loadStudentPaymentCard(client, { userId: "u-student", applicationId: "app-1" });
      expect(view && view.kind === "enabled_methods" ? view.instructions : "x").toBeNull();
    }
  });
});

describe("splitInstructionsSnapshot", () => {
  it("separa la etiqueta de los datos", () => {
    expect(splitInstructionsSnapshot(SNAPSHOT)).toEqual({ label: "Transferencia en pesos", details: "Alias: casa.norte CBU 0170099220000067797370" });
    expect(splitInstructionsSnapshot(null)).toEqual({ label: null, details: null });
    expect(splitInstructionsSnapshot("solo datos")).toEqual({ label: null, details: "solo datos" });
  });
});
