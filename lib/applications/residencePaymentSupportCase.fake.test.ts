import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { action: string }[]);
vi.mock("@/lib/audit", () => ({ createAuditLog: async (_a: unknown, e: { action: string }) => (audits.push(e), true) }));
const adminNotices = vi.hoisted(() => [] as unknown[]);
vi.mock("@/lib/notifications/notifyAdminsSafe", () => ({ notifyAdminsSafe: async (_a: unknown, p: unknown) => void adminNotices.push(p) }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { openResidencePaymentSupportCase } from "@/lib/applications/residencePaymentSupportCase";

/** DR63 (j) 1 + 0104: un solo caso abierto por solicitud; un 23505 por carrera es un éxito, no un error. */
const params = {
  applicationId: "app-1",
  residenceId: "res-1",
  openedByUserId: "u-1",
  openedByRole: "system",
  description: "El estudiante avisó hace más de 72 horas que pagó la reserva y la residencia no respondió.",
  auditSource: "system" as const,
};

beforeEach(() => {
  audits.length = 0;
  adminNotices.length = 0;
});

describe("openResidencePaymentSupportCase", () => {
  it("crea el caso, audita y avisa al admin; la segunda llamada devuelve el mismo sin duplicar", async () => {
    const fake = createInMemorySupabase({ support_cases: [] });
    const first = await openResidencePaymentSupportCase(fake.client, params);
    expect(first).toMatchObject({ ok: true, created: true });
    const second = await openResidencePaymentSupportCase(fake.client, params);
    expect(second).toMatchObject({ ok: true, created: false, supportCaseId: (first as { supportCaseId: string }).supportCaseId });
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(adminNotices).toHaveLength(1);
  });

  it("un caso cerrado no bloquea uno nuevo", async () => {
    const fake = createInMemorySupabase({ support_cases: [{ id: "old", topic: "residence_payment", related_entity_id: "app-1", status: "closed_no_action" }] });
    expect(await openResidencePaymentSupportCase(fake.client, params)).toMatchObject({ ok: true, created: true });
    expect(fake.tables.support_cases).toHaveLength(2);
  });

  it("carrera: si el insert choca con el índice único (23505) devuelve el caso abierto por el otro proceso como éxito", async () => {
    const fake = createInMemorySupabase({ support_cases: [] }, { failInsert: { support_cases: { code: "23505", message: "duplicate key value violates unique constraint" } } });
    // El otro proceso gana la carrera: su caso aparece entre la búsqueda y el insert.
    const real = fake.client.from.bind(fake.client);
    let inserted = false;
    (fake.client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
      const q = real(table) as { insert: (p: Row) => unknown };
      if (table === "support_cases" && !inserted) {
        const originalInsert = q.insert.bind(q);
        q.insert = (payload: Row) => {
          inserted = true;
          fake.tables.support_cases.push({ id: "winner", topic: "residence_payment", related_entity_id: "app-1", status: "opened" });
          return originalInsert(payload);
        };
      }
      return q;
    };
    const res = await openResidencePaymentSupportCase(fake.client, params);
    expect(res).toEqual({ ok: true, supportCaseId: "winner", created: false });
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(adminNotices).toHaveLength(0);
  });

  it("23505 sin caso abierto visible no es éxito", async () => {
    const fake = createInMemorySupabase({ support_cases: [] }, { failInsert: { support_cases: { code: "23505", message: "dup" } } });
    expect(await openResidencePaymentSupportCase(fake.client, params)).toEqual({ ok: false, schemaMissing: false });
  });
});
