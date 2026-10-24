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
