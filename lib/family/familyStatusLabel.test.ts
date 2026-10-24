import { describe, expect, it } from "vitest";
import { familyStatusLabel } from "@/lib/family/familyStatusLabel";
import { KNOWN_APPLICATION_STATUSES, KNOWN_RESERVATION_STATUSES, getVisibleStatus } from "@/lib/applications/visibleStatus";

describe("familyStatusLabel", () => {
  it("pasa a tercera persona los rótulos imperativos o con 'vos'", () => {
    expect(familyStatusLabel("Pagá el fee EstuRed")).toBe("Fee EstuRed por pagar");
    expect(familyStatusLabel("Cancelada por vos")).toBe("Cancelada por el estudiante");
  });
  it("deja igual los rótulos neutros", () => {
    expect(familyStatusLabel("Reserva confirmada")).toBe("Reserva confirmada");
  });
  it("ningún rótulo de estudiante queda en segunda persona tras la traducción", () => {
    const labels = [
      ...KNOWN_APPLICATION_STATUSES.map((s) => getVisibleStatus({ applicationStatus: s, viewer: "student" }).label),
      ...KNOWN_RESERVATION_STATUSES.map((s) =>
        getVisibleStatus({ applicationStatus: "converted_to_reservation", reservation: { status: s }, viewer: "student" }).label,
      ),
    ].map(familyStatusLabel);
    for (const label of labels) {
      expect(label).not.toMatch(/\bvos\b|^Pagá|^Respondé|^Elegí|no respondiste/i);
    }
  });
});
