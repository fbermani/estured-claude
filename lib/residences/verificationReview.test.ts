import { describe, expect, it } from "vitest";
import {
  argentinaToday,
  canReviewFrom,
  expiresWithin,
  parseDateOnly,
  queueChipKey,
  sortQueue,
  summarizeQueue,
  validateReview,
  wasResubmitted,
  type ReviewInput,
} from "@/lib/residences/verificationReview";

const base: ReviewInput = {
  action: "approve",
  confirmed: true,
  responsibleChecked: true,
  addressChecked: true,
  photosMatch: true,
  visitedAt: "2026-10-20",
  scheduledAt: "",
  notesInternal: "",
  changesMessage: "",
  today: "2026-10-24",
};

describe("validateReview", () => {
  it("aprueba con visita, checklist y confirmación", () => {
    const r = validateReview(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.visitedAtIso).toBe("2026-10-20T12:00:00.000Z");
  });
  it("no aprueba sin fecha de visita", () => {
    const r = validateReview({ ...base, visitedAt: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/visita presencial/);
  });
  it("no aprueba con visita futura ni fecha inválida", () => {
    expect(validateReview({ ...base, visitedAt: "2026-10-25" }).ok).toBe(false);
    expect(validateReview({ ...base, visitedAt: "2026-02-31" }).ok).toBe(false);
    expect(validateReview({ ...base, visitedAt: "ayer" }).ok).toBe(false);
  });
  it("aprueba el mismo día de la visita", () => {
    expect(validateReview({ ...base, visitedAt: "2026-10-24" }).ok).toBe(true);
  });
  it("no aprueba sin confirmación ni sin checklist mínimo", () => {
    expect(validateReview({ ...base, confirmed: false }).ok).toBe(false);
    expect(validateReview({ ...base, addressChecked: false }).ok).toBe(false);
    expect(validateReview({ ...base, photosMatch: false }).ok).toBe(false);
    expect(validateReview({ ...base, responsibleChecked: false }).ok).toBe(false);
  });
  it("programar exige fecha, no anterior a hoy, y no pide checklist ni confirmación", () => {
    const sched = { ...base, action: "schedule" as const, confirmed: false, responsibleChecked: false, visitedAt: "" };
    expect(validateReview({ ...sched, scheduledAt: "" }).ok).toBe(false);
    expect(validateReview({ ...sched, scheduledAt: "2026-10-23" }).ok).toBe(false);
    const ok = validateReview({ ...sched, scheduledAt: "2026-10-24" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.scheduledAtIso).toBe("2026-10-24T12:00:00.000Z");
  });
  it("pedir cambios exige mensaje de 10+ caracteres y no la visita", () => {
    const nc = { ...base, action: "needs_changes" as const, confirmed: false, visitedAt: "" };
    expect(validateReview({ ...nc, changesMessage: "corto" }).ok).toBe(false);
    const ok = validateReview({ ...nc, changesMessage: "  Falta la foto del frente.  " });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.changesMessage).toBe("Falta la foto del frente.");
  });
  it("rechazar exige confirmación y motivo interno", () => {
    const rj = { ...base, action: "reject" as const, visitedAt: "" };
    expect(validateReview({ ...rj, confirmed: false, notesInternal: "motivo claro" }).ok).toBe(false);
    expect(validateReview({ ...rj, notesInternal: "no" }).ok).toBe(false);
    expect(validateReview({ ...rj, notesInternal: "No coincide la dirección" }).ok).toBe(true);
  });
});

describe("canReviewFrom", () => {
  it("permite decidir desde pendiente, programada y vencida", () => {
    for (const status of ["pending_verification", "verification_scheduled", "verification_expired"]) {
      for (const a of ["schedule", "approve", "needs_changes", "reject"] as const) expect(canReviewFrom(a, status)).toBe(true);
    }
  });
  it("no pisa estados ya resueltos", () => {
    for (const status of ["verified_active", "suspended", "draft", "archived", "paused_by_admin", null, undefined]) {
      for (const a of ["schedule", "approve", "needs_changes", "reject"] as const) expect(canReviewFrom(a, status)).toBe(false);
    }
  });
  it("desde needs_changes solo se puede rechazar", () => {
    expect(canReviewFrom("reject", "needs_changes")).toBe(true);
    for (const a of ["schedule", "approve", "needs_changes"] as const) expect(canReviewFrom(a, "needs_changes")).toBe(false);
  });
});

describe("fechas", () => {
  it("parseDateOnly valida días reales", () => {
    expect(parseDateOnly("2026-10-24")).toBe("2026-10-24");
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("24/10/2026")).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
  });
  it("argentinaToday usa hora de Buenos Aires", () => {
    // 01:00 UTC del 25 = 22:00 del 24 en Buenos Aires.
    expect(argentinaToday(new Date("2026-10-25T01:00:00Z"))).toBe("2026-10-24");
    expect(argentinaToday(new Date("2026-10-25T04:00:00Z"))).toBe("2026-10-25");
  });
});

describe("cola", () => {
  it("distingue Nueva de Reenviada solo en pending_verification", () => {
    expect(wasResubmitted("pending_verification", "residence_profile_resubmitted")).toBe(true);
    expect(wasResubmitted("pending_verification", "residence_verification_needs_changes")).toBe(false);
    expect(wasResubmitted("pending_verification", null)).toBe(false);
    expect(wasResubmitted("verification_scheduled", "residence_profile_resubmitted")).toBe(false);
    expect(queueChipKey("pending_verification", false)).toBe("new");
    expect(queueChipKey("pending_verification", true)).toBe("resubmitted");
    expect(queueChipKey("verification_expired", false)).toBe("expired");
    expect(queueChipKey("verification_scheduled", false)).toBe("scheduled");
    expect(queueChipKey("needs_changes", false)).toBe("needs_changes");
  });
  it("cuenta aparte lo que espera a la residencia y lo manda al final", () => {
    expect(summarizeQueue(["pending_verification", "needs_changes", "verification_expired"])).toEqual({ toReview: 2, waitingForResidence: 1 });
    const sorted = sortQueue([
      { status: "needs_changes", created_at: "2026-01-01" },
      { status: "pending_verification", created_at: "2026-03-01" },
      { status: "verification_expired", created_at: "2026-02-01" },
    ]);
    expect(sorted.map((r) => r.status)).toEqual(["verification_expired", "pending_verification", "needs_changes"]);
  });
});

describe("expiresWithin", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  it("solo dentro de la ventana y sin vencer", () => {
    expect(expiresWithin("2026-11-10T00:00:00Z", now, 30)).toBe(true);
    expect(expiresWithin("2026-12-10T00:00:00Z", now, 30)).toBe(false);
    expect(expiresWithin("2026-10-20T00:00:00Z", now, 30)).toBe(false);
    expect(expiresWithin(null, now, 30)).toBe(false);
  });
});
