import { describe, expect, it } from "vitest";
import { modeOpensSheet, resolveRequestPanelMode } from "@/lib/residences/requestPanelMode";

const base = { roles: ["student"] as const, isOwnResidenceTeam: false, minorBlock: null, linkedStudentsCount: 0 };

describe("resolveRequestPanelMode", () => {
  it("sin sesión es invitado", () => {
    expect(resolveRequestPanelMode({ ...base, roles: null })).toBe("guest");
  });
  it("estudiante común y menor bloqueado", () => {
    expect(resolveRequestPanelMode({ ...base, roles: ["student"] })).toBe("student");
    expect(resolveRequestPanelMode({ ...base, roles: ["student"], minorBlock: "no_family" })).toBe("minor_no_family");
    expect(resolveRequestPanelMode({ ...base, roles: ["student"], minorBlock: "no_phone" })).toBe("minor_no_phone");
  });
  it("familiar con y sin estudiantes vinculados", () => {
    expect(resolveRequestPanelMode({ ...base, roles: ["family_member"], linkedStudentsCount: 1 })).toBe("family");
    expect(resolveRequestPanelMode({ ...base, roles: ["family_member"] })).toBe("family_unlinked");
  });
  it("el equipo de la residencia manda sobre cualquier otro rol", () => {
    expect(resolveRequestPanelMode({ ...base, roles: ["residence_owner"], isOwnResidenceTeam: true })).toBe("team");
    expect(resolveRequestPanelMode({ ...base, roles: ["residence_owner", "student"], isOwnResidenceTeam: true })).toBe("team");
  });
  it("admin u owner de otra residencia no ven acciones de solicitud", () => {
    expect(resolveRequestPanelMode({ ...base, roles: ["admin"] })).toBe("other");
    expect(resolveRequestPanelMode({ ...base, roles: ["residence_owner"] })).toBe("other");
  });
  it("solo estudiante y familiar abren la hoja", () => {
    expect(modeOpensSheet("student")).toBe(true);
    expect(modeOpensSheet("family")).toBe(true);
    expect(modeOpensSheet("guest")).toBe(false);
    expect(modeOpensSheet("team")).toBe(false);
  });
});
