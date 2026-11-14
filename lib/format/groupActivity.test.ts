import { describe, expect, it } from "vitest";
import { groupConsecutiveActivity } from "@/lib/format/groupActivity";

const ev = (id: string, action: string, created_at: string, actor_role = "student") => ({ id, action, created_at, actor_role });

describe("groupConsecutiveActivity", () => {
  it("agrupa vecinos idénticos y conserva el rango de fechas", () => {
    const out = groupConsecutiveActivity([ev("1", "a", "2026-11-14T10:00:00Z"), ev("2", "a", "2026-11-14T09:00:00Z"), ev("3", "a", "2026-11-14T08:00:00Z")]);
    expect(out).toEqual([{ id: "1", action: "a", actor_role: "student", count: 3, latest: "2026-11-14T10:00:00Z", oldest: "2026-11-14T08:00:00Z" }]);
  });

  it("no junta eventos iguales separados por otro distinto ni de otro actor", () => {
    const out = groupConsecutiveActivity([ev("1", "a", "t3"), ev("2", "b", "t2"), ev("3", "a", "t1"), ev("4", "a", "t0", "admin")]);
    expect(out.map((g) => [g.action, g.actor_role, g.count])).toEqual([["a", "student", 1], ["b", "student", 1], ["a", "student", 1], ["a", "admin", 1]]);
  });

  it("lista vacía", () => {
    expect(groupConsecutiveActivity([])).toEqual([]);
  });
});
