import { describe, expect, it } from "vitest";
import { staleAvailabilityMessage } from "./staleAvailability";

describe("staleAvailabilityMessage", () => {
  it("sin datos o sin vencidas → null", () => {
    expect(staleAvailabilityMessage(undefined)).toBeNull();
    expect(staleAvailabilityMessage({ hidden: 0, notUpdated: 0 })).toBeNull();
  });
  it("tipos ya ocultos de las búsquedas (DR69: tampoco reciben solicitudes)", () => {
    const message =
      "Hay habitaciones sin actualizar hace más de 45 días. No se ven en las búsquedas ni reciben solicitudes de reserva. Actualizá tu disponibilidad.";
    expect(staleAvailabilityMessage({ hidden: 2, notUpdated: 0 })).toBe(message);
    expect(staleAvailabilityMessage({ hidden: 1, notUpdated: 3 })).toBe(message);
  });
  it("tipos por ocultarse", () => {
    expect(staleAvailabilityMessage({ hidden: 0, notUpdated: 1 })).toContain("1 tipo de habitación lleva más de 30 días");
  });
});
