import { describe, expect, it } from "vitest";
import { isShareFeatureNew } from "@/lib/share/newBadge";

describe("isShareFeatureNew", () => {
  it("está vigente antes de la fecha de corte y se apaga después", () => {
    expect(isShareFeatureNew(new Date("2026-11-17T12:00:00-03:00"))).toBe(true);
    expect(isShareFeatureNew(new Date("2026-12-31T22:00:00-03:00"))).toBe(true);
    expect(isShareFeatureNew(new Date("2027-01-01T00:30:00-03:00"))).toBe(false);
  });
});
