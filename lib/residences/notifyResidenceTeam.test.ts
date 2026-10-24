import { describe, expect, it } from "vitest";
import { buildResidenceTeamMessage, pickTeamRecipients } from "@/lib/residences/notifyResidenceTeam";

describe("pickTeamRecipients", () => {
  it("excluye inactivos y bloqueados, y no repite", () => {
    const out = pickTeamRecipients([
      { id: "a", email: "a@x.com", is_active: true, is_blocked: false },
      { id: "a", email: "a@x.com", is_active: true, is_blocked: false },
      { id: "b", email: "b@x.com", is_active: false, is_blocked: false },
      { id: "c", email: "c@x.com", is_active: true, is_blocked: true },
      { id: "d", email: null, is_active: true, is_blocked: null },
    ]);
    expect(out).toEqual([
      { id: "a", email: "a@x.com" },
      { id: "d", email: null },
    ]);
  });
});

describe("buildResidenceTeamMessage", () => {
  it("el aviso de solicitud nombra la residencia y no promete disponibilidad", () => {
    const m = buildResidenceTeamMessage("new_application", "Residencia Norte");
    expect(m.title).toBe("Tenés una solicitud nueva en Residencia Norte");
    expect(m.intro).toContain("Residencia Norte");
    expect(`${m.title} ${m.body} ${m.intro}`.toLowerCase()).not.toMatch(/garantiz|disponib(le|ilidad) asegurada/);
  });
  it("cubre los tres eventos", () => {
    for (const e of ["new_application", "new_waitlist_entry", "new_renewal_request"] as const) {
      const m = buildResidenceTeamMessage(e, "X");
      expect(m.subject.startsWith("EstuRed")).toBe(true);
      expect(m.cta.length).toBeGreaterThan(0);
    }
  });
});
