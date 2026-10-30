import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { action: string; newValue?: { requests: number } }[]);
vi.mock("@/lib/audit", () => ({ createAuditLog: async (_a: unknown, e: (typeof audits)[number]) => { audits.push(e); return true; } }));

import { markMissingResidenceContacted } from "@/lib/residents/missingResidencesAdmin";

const U = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
function fakeAdmin(updatedIds: string[]) {
  const chain = { update: () => chain, in: () => chain, is: () => chain, select: async () => ({ data: updatedIds.map((id) => ({ id })), error: null }) };
  return { from: () => chain } as never;
}

describe("markMissingResidenceContacted", () => {
  it("audita solo las filas realmente actualizadas", async () => {
    audits.length = 0;
    const r = await markMissingResidenceContacted(fakeAdmin([U(1)]), { actorUserId: "a", actorRole: "admin", ids: [U(1), U(2)] });
    expect(r.ok).toBe(true);
    expect(audits[0].newValue?.requests).toBe(1);
  });
  it("si ya estaban contactadas no audita de nuevo", async () => {
    audits.length = 0;
    await markMissingResidenceContacted(fakeAdmin([]), { actorUserId: "a", actorRole: "admin", ids: [U(1)] });
    expect(audits).toHaveLength(0);
  });
  it("rechaza ids inválidos", async () => {
    const r = await markMissingResidenceContacted(fakeAdmin([]), { actorUserId: "a", actorRole: "admin", ids: ["x"] });
    expect(r.ok).toBe(false);
  });
});
