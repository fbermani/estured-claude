import { describe, expect, it } from "vitest";
import { pluralize } from "@/lib/format/plural";

describe("pluralize", () => {
  it("usa singular solo con 1", () => {
    expect(pluralize(1, "día", "días")).toBe("1 día");
    expect(pluralize(0, "día", "días")).toBe("0 días");
    expect(pluralize(7, "día", "días")).toBe("7 días");
  });
});
