import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => true) }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: vi.fn(async () => undefined) }));

import { updateSupportCaseStatus } from "@/lib/support/updateSupportCaseStatus";

function fakeAdmin(topic: string) {
  const updates: unknown[] = [];
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = () =>
    Promise.resolve({
      data: { id: "c1", status: "opened", topic, opened_by_user_id: "u1", related_entity_type: "reservations", residences: null },
      error: null,
    });
  chain.update = (payload: unknown) => {
    updates.push(payload);
    return chain;
  };
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
  return { admin: { from: () => chain } as unknown as SupabaseClient, updates };
}

const params = {
  supportCaseId: "c1",
  actorUserId: "admin",
  actorRole: "admin",
  newStatus: "closed_no_action",
  outcome: "closed_no_action",
  notes: "Cerrado a mano.",
};

describe("updateSupportCaseStatus (unitario)", () => {
  it("rechaza cambiar el estado de un caso fee_revocation: se cierra solo al resolver la revocación", async () => {
    const { admin, updates } = fakeAdmin("fee_revocation");
    const r = await updateSupportCaseStatus(admin, params);
    expect(r).toMatchObject({ status: "error", message: expect.stringMatching(/revocaci/i) });
    expect(updates).toHaveLength(0);
  });

  it("otros topics siguen funcionando", async () => {
    const { admin, updates } = fakeAdmin("estured_fee_payment");
    expect(await updateSupportCaseStatus(admin, params)).toEqual({ status: "ok" });
    expect(updates).toHaveLength(1);
  });
});
