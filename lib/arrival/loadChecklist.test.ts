import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { loadCheckedItems } from "./loadChecklist";

function fake(result: { data?: unknown; error?: { code?: string } | null }) {
  return { from: () => ({ select: () => ({ in: async () => ({ data: result.data ?? null, error: result.error ?? null }) }) }) } as never;
}

describe("loadCheckedItems", () => {
  it("agrupa por reserva", async () => {
    const r = await loadCheckedItems(fake({ data: [{ reservation_id: "a", item_key: "x" }, { reservation_id: "a", item_key: "y" }] }), ["a"]);
    expect(r.persistent).toBe(true);
    expect(r.byReservation.get("a")).toEqual(["x", "y"]);
  });
  it("tabla ausente (0068 sin aplicar) → persistent=false sin romper", async () => {
    const r = await loadCheckedItems(fake({ error: { code: "PGRST205" } }), ["a"]);
    expect(r.persistent).toBe(false);
    expect(r.byReservation.size).toBe(0);
  });
});
