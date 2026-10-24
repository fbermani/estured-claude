import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => true) }));

import { openFeeRevocationSupportCase } from "@/lib/revocations/openRevocationSupportCase";

function fakeAdmin(opts: { existing?: { id: string; status: string }[]; lookupError?: { code: string; message: string }; insertError?: { code: string; message: string }; throws?: boolean }) {
  const inserts: Record<string, unknown>[] = [];
  const client = {
    from() {
      if (opts.throws) throw new Error("boom");
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve(opts.lookupError ? { data: null, error: opts.lookupError } : { data: opts.existing ?? [], error: null });
      chain.insert = (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return {
          select: () => ({
            single: () =>
              Promise.resolve(opts.insertError ? { data: null, error: opts.insertError } : { data: { id: "case-1" }, error: null }),
          }),
        };
      };
      return chain;
    },
  };
  return { admin: client as unknown as SupabaseClient, inserts };
}

const base = { actorUserId: "u1", actorRole: "student" as const, reservationId: "res-1", residenceName: "Residencia Norte", studentReason: "Conseguí otro lugar." };

describe("openFeeRevocationSupportCase (best-effort)", () => {
  it("abre un caso fee_revocation sin residencia y con la reserva como contexto", async () => {
    const { admin, inserts } = fakeAdmin({});
    expect(await openFeeRevocationSupportCase(admin, base)).toEqual({ ok: true, supportCaseId: "case-1" });
    expect(inserts[0]).toMatchObject({
      topic: "fee_revocation",
      residence_id: null,
      terms_reminder_accepted_at: null,
      related_entity_type: "reservations",
      related_entity_id: "res-1",
      opened_by_user_id: "u1",
    });
    expect(String(inserts[0].description).length).toBeGreaterThanOrEqual(20);
    expect(String(inserts[0].description)).toContain("Conseguí otro lugar.");
  });

  it("la descripción alcanza el mínimo de 20 caracteres aun sin motivo ni residencia", async () => {
    const { admin, inserts } = fakeAdmin({});
    await openFeeRevocationSupportCase(admin, { ...base, residenceName: null, studentReason: null });
    expect(String(inserts[0].description).length).toBeGreaterThanOrEqual(20);
  });

  it("no duplica el caso si ya hay uno abierto para la reserva", async () => {
    const { admin, inserts } = fakeAdmin({ existing: [{ id: "case-0", status: "under_review" }] });
    expect(await openFeeRevocationSupportCase(admin, base)).toEqual({ ok: true, supportCaseId: "case-0" });
    expect(inserts).toHaveLength(0);
  });

  it("nunca lanza ni rompe la revocación: 0049 sin aplicar, error de lectura o excepción", async () => {
    expect(await openFeeRevocationSupportCase(fakeAdmin({ insertError: { code: "23514", message: "violates check constraint" } }).admin, base)).toEqual({ ok: false });
    expect(await openFeeRevocationSupportCase(fakeAdmin({ lookupError: { code: "42703", message: "column topic does not exist" } }).admin, base)).toEqual({ ok: false });
    expect(await openFeeRevocationSupportCase(fakeAdmin({ throws: true }).admin, base)).toEqual({ ok: false });
  });
});
