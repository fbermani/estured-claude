import { describe, expect, it } from "vitest";
import { permissionsFromChecked } from "@/lib/residences/permissions";
import { buildResidenceTeamMessage, filterTeamByEvent, OWNER_ONLY_EVENTS, pickTeamRecipients } from "@/lib/residences/notifyResidenceTeam";

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
  it("el aviso de cambios pedidos nombra la residencia y no vuelca texto del admin", () => {
    const m = buildResidenceTeamMessage("changes_requested", "Casa Norte");
    expect(m.title).toBe("Pedimos cambios en tu perfil de Casa Norte");
    expect(m.intro).toBe("Pedimos cambios en tu perfil de Casa Norte. Entrá a tu panel para ver qué corregir y reenviarlo.");
    expect(m.cta.length).toBeGreaterThan(0);
  });
  it("aprobación y rechazo no vuelcan motivos ni prometen plazos; el rechazo remite a Soporte", () => {
    const ok = buildResidenceTeamMessage("verification_approved", "Casa Norte");
    expect(ok.title).toBe("Aprobamos la verificación de Casa Norte");
    const no = buildResidenceTeamMessage("verification_rejected", "Casa Norte");
    expect(no.body).toContain("Soporte");
    for (const m of [ok, no]) expect(`${m.title} ${m.body} ${m.intro}`.toLowerCase()).not.toMatch(/mediaci|garantiz|\d+ (días|horas)/);
  });
  it("cubre todos los eventos", () => {
    for (const e of ["new_application", "new_waitlist_entry", "new_renewal_request", "changes_requested", "verification_approved", "verification_rejected", "verification_expiring", "team_member_joined"] as const) {
      const m = buildResidenceTeamMessage(e, "X");
      expect(m.subject.startsWith("EstuRed")).toBe(true);
      expect(m.cta.length).toBeGreaterThan(0);
    }
  });
});

describe("avisos solo para el dueño (DR10)", () => {
  const rows = [
    { user_id: "o", role: "owner" },
    { user_id: "s", role: "staff", permissions: {} },
  ];
  it("los avisos de verificación y de equipo van solo al dueño", () => {
    for (const e of ["changes_requested", "verification_approved", "verification_rejected", "verification_expiring", "team_member_joined"] as const) {
      expect(OWNER_ONLY_EVENTS.has(e), e).toBe(true);
      expect(filterTeamByEvent(e, rows).map((r) => r.user_id), e).toEqual(["o"]);
    }
  });
  it("el día a día va al dueño y al staff con el permiso (valores iniciales de `{}`)", () => {
    for (const e of ["new_application", "new_waitlist_entry", "new_renewal_request"] as const) {
      expect(filterTeamByEvent(e, rows).map((r) => r.user_id), e).toEqual(["o", "s"]);
    }
  });
  it("el staff sin el permiso del evento no recibe el aviso; el dueño siempre", () => {
    const team = [
      { user_id: "o", role: "owner" },
      { user_id: "sin", role: "staff", permissions: permissionsFromChecked([]) },
      { user_id: "solo-sol", role: "staff", permissions: permissionsFromChecked(["applications.review_contact"]) },
      { user_id: "solo-esp", role: "staff", permissions: permissionsFromChecked(["waitlist.manage"]) },
      { user_id: "solo-ren", role: "staff", permissions: permissionsFromChecked(["renewals.manage"]) },
      { user_id: "sin-clave", role: "staff" }, // sin permisos guardados: falla cerrado
      { user_id: "basura", role: "staff", permissions: { ...permissionsFromChecked([]), "waitlist.manage": "true" } }, // no booleano: apagado
    ];
    expect(filterTeamByEvent("new_application", team).map((r) => r.user_id)).toEqual(["o", "solo-sol"]);
    expect(filterTeamByEvent("new_waitlist_entry", team).map((r) => r.user_id)).toEqual(["o", "solo-esp"]);
    expect(filterTeamByEvent("new_renewal_request", team).map((r) => r.user_id)).toEqual(["o", "solo-ren"]);
  });
  it("el aviso de que aceptaron la invitación no vuelca emails ni datos de la persona", () => {
    const m = buildResidenceTeamMessage("team_member_joined", "Casa Norte");
    expect(m.title).toBe("Alguien aceptó tu invitación al equipo de Casa Norte");
    expect(`${m.title} ${m.body} ${m.intro}`).not.toMatch(/@/);
  });
});
