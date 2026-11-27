import { describe, expect, it } from "vitest";
import { buildFamilyInviteEmail } from "@/lib/preapertura/familyInviteEmail";

const link = "https://estured.com/preregistro?invitacion=abc_DEF-123";

describe("mail de invitación del familiar", () => {
  const { subject, html } = buildFamilyInviteEmail({ inviteUrl: link });
  it("mantiene el asunto y lleva el link en el botón y en texto", () => {
    expect(subject).toBe("Te invitaron a sumarte a EstuRed");
    expect(html.split(`href="${link}"`).length - 1).toBe(2);
  });
  it("muestra los tres beneficios aprobados", () => {
    for (const benefit of ["Residencias verificadas en persona", "Reglas y costos claros", "Conocé la comunidad antes de elegir"]) {
      expect(html).toContain(benefit);
    }
  });
  it("avisa qué hacer si no se esperaba y no promete disponibilidad ni reserva", () => {
    expect(html).toContain("Si no esperabas este mensaje, ignoralo.");
    expect(html).not.toMatch(/garantiz|reserv|disponib|solicit[áa]r/i);
  });
});
