import { describe, expect, it } from "vitest";
import { buildOnboardingChecklist, getOnboardingBanner } from "./onboardingStatus";

describe("getOnboardingBanner", () => {
  it("sin banner para residencias verificadas y publicadas", () => {
    expect(getOnboardingBanner("verified_active")).toBeNull();
  });
  it("pendiente no promete plazos", () => {
    const b = getOnboardingBanner("pending_verification");
    expect(b?.now).toContain("mail y en la campana");
    expect(`${b?.now} ${b?.meanwhile}`).not.toMatch(/\d+\s*(h|hs|horas|días)/);
  });
  it("cubre borrador, cambios pedidos y rechazo", () => {
    expect(getOnboardingBanner("draft")?.tone).toBe("info");
    expect(getOnboardingBanner("needs_changes")?.tone).toBe("warning");
    expect(getOnboardingBanner("suspended")?.tone).toBe("danger");
    const expired = getOnboardingBanner("verification_expired");
    expect(expired?.tone).toBe("warning");
    expect(expired?.cta?.href).toBe("profile");
  });
});

describe("getOnboardingBanner: needs_changes (DR5)", () => {
  it("muestra el mensaje del admin y el CTA a /profile", () => {
    const b = getOnboardingBanner("needs_changes", { changesMessage: "  Faltan fotos del baño.  " });
    expect(b?.adminMessage).toBe("Faltan fotos del baño.");
    expect(b?.cta).toEqual({ label: "Corregir y reenviar", href: "profile" });
    expect(`${b?.now} ${b?.meanwhile}`).not.toMatch(/Soporte/);
  });
  it("sin mensaje (cambios pedidos antes de la 0048) usa el copy genérico y sigue ofreciendo reenviar", () => {
    const b = getOnboardingBanner("needs_changes");
    expect(b?.adminMessage).toBeNull();
    expect(b?.now).toContain("información del perfil para corregir");
    expect(b?.cta?.label).toBe("Corregir y reenviar");
  });
  it("los otros estados no llevan mensaje ni CTA", () => {
    expect(getOnboardingBanner("pending_verification", { changesMessage: "x".repeat(20) })?.adminMessage).toBeUndefined();
    expect(getOnboardingBanner("draft")?.cta).toBeUndefined();
  });
});

describe("buildOnboardingChecklist", () => {
  const base = { profileGapsCount: 0, photos: 3, hasRules: true, verificationStatus: "documents_pending", scheduledAt: null };
  it("marca cada ítem según los datos", () => {
    const items = buildOnboardingChecklist({ ...base, profileGapsCount: 2, photos: 0, hasRules: false });
    expect(items.map((i) => i.state)).toEqual(["todo", "todo", "todo", "todo"]);
  });
  it("fotos parciales quedan en curso", () => {
    expect(buildOnboardingChecklist({ ...base, photos: 1 })[1].state).toBe("in_progress");
  });
  it("visita programada y aprobada", () => {
    expect(buildOnboardingChecklist({ ...base, verificationStatus: "visit_scheduled" })[3].state).toBe("in_progress");
    expect(buildOnboardingChecklist({ ...base, verificationStatus: "approved" })[3].state).toBe("done");
  });
});
