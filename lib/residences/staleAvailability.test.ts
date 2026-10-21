import { describe, expect, it } from "vitest";
import { staleAvailabilityMessage } from "./staleAvailability";

describe("staleAvailabilityMessage", () => {
  it("sin datos o sin vencidas → null", () => {
    expect(staleAvailabilityMessage(undefined)).toBeNull();
    expect(staleAvailabilityMessage({ hidden: 0, notUpdated: 0 })).toBeNull();
  });
  it("tipos ya ocultos de las búsquedas", () => {
    expect(staleAvailabilityMessage({ hidden: 2, notUpdated: 0 })).toContain("2 tipos de habitación están ocultos");
    expect(staleAvailabilityMessage({ hidden: 1, notUpdated: 3 })).toContain("1 tipo de habitación está oculto");
    expect(staleAvailabilityMessage({ hidden: 1, notUpdated: 3 })).toContain("Otros 3 llevan más de 30 días");
  });
  it("tipos por ocultarse", () => {
    expect(staleAvailabilityMessage({ hidden: 0, notUpdated: 1 })).toContain("1 tipo de habitación lleva más de 30 días");
  });
});
