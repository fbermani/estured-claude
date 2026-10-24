import { describe, expect, it } from "vitest";
import { buildPlanningSummary, buildStayChangeSteps, monthNameOf, responseBadge, timeAgoLabel } from "@/lib/stayChange/ui";

describe("buildStayChangeSteps", () => {
  it("sin respuesta: avisaste hecho, respuesta actual", () => {
    const steps = buildStayChangeSteps("open_no_response");
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "pending", "pending"]);
    expect(steps[1].label).toBe("Tu residencia responde");
  });
  it("con respuesta: busca actual y el paso 2 pasa a pasado", () => {
    const steps = buildStayChangeSteps("open_responded");
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "pending"]);
    expect(steps[1].label).toBe("Tu residencia respondió");
  });
  it("pendiente del familiar: el primer paso es la confirmación", () => {
    const steps = buildStayChangeSteps("pending_family");
    expect(steps[0].state).toBe("current");
    expect(steps[0].label).toBe("Tu familiar confirma el aviso");
  });
  it("resuelto: todo hecho", () => {
    expect(buildStayChangeSteps("resolved").every((s) => s.state === "done")).toBe(true);
  });
});

describe("buildPlanningSummary", () => {
  it("agrupa por tipo y mes, ordenado por fecha", () => {
    const text = buildPlanningSummary([
      { roomTypeName: "Doble", estimatedExitDate: "2027-03-10" },
      { roomTypeName: "Individual", estimatedExitDate: "2026-12-15" },
    ]);
    expect(text).toBe("Si se van en las fechas estimadas, se liberan 1 Individual desde diciembre y 1 Doble desde marzo.");
  });
  it("cuenta plazas del mismo tipo y mes", () => {
    const text = buildPlanningSummary([
      { roomTypeName: "Individual", estimatedExitDate: "2026-12-01" },
      { roomTypeName: "Individual", estimatedExitDate: "2026-12-20" },
    ]);
    expect(text).toContain("2 plazas Individual desde diciembre");
  });
  it("singular con una sola plaza", () => {
    expect(buildPlanningSummary([{ roomTypeName: "Doble", estimatedExitDate: "2027-01-05" }])).toBe(
      "Si se van en las fechas estimadas, se libera 1 Doble desde enero.",
    );
  });
  it("sin fechas no hay resumen", () => {
    expect(buildPlanningSummary([{ roomTypeName: "Doble", estimatedExitDate: null }])).toBeNull();
    expect(buildPlanningSummary([])).toBeNull();
  });
});

describe("helpers menores", () => {
  it("monthNameOf valida el formato", () => {
    expect(monthNameOf("2026-02-03")).toBe("febrero");
    expect(monthNameOf("hoy")).toBeNull();
    expect(monthNameOf(null)).toBeNull();
  });
  it("timeAgoLabel", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    expect(timeAgoLabel("2026-10-23T08:00:00Z", now)).toBe("hoy");
    expect(timeAgoLabel("2026-10-22T08:00:00Z", now)).toBe("ayer");
    expect(timeAgoLabel("2026-10-18T08:00:00Z", now)).toBe("hace 5 días");
  });
  it("responseBadge", () => {
    expect(responseBadge(null).key).toBe("unanswered");
    expect(responseBadge({ seenByStudentAt: null }).key).toBe("answered");
    expect(responseBadge({ seenByStudentAt: "2026-10-20T00:00:00Z" }).key).toBe("answered_seen");
  });
});

import { arDateOf } from "@/lib/stayChange/ui";
describe("arDateOf", () => {
  it("usa la fecha de Buenos Aires, no la UTC", () => {
    expect(arDateOf("2026-10-24T01:30:00Z")).toBe("2026-10-23");
    expect(arDateOf("2026-10-23T15:00:00Z")).toBe("2026-10-23");
  });
});

import { dayBefore } from "@/lib/stayChange/ui";
describe("dayBefore", () => {
  it("resta un día, también al cruzar de mes y de año", () => {
    expect(dayBefore("2026-11-05")).toBe("2026-11-04");
    expect(dayBefore("2026-12-01")).toBe("2026-11-30");
    expect(dayBefore("2027-01-01")).toBe("2026-12-31");
  });
});

import { tidyShortName } from "@/lib/stayChange/ui";
describe("tidyShortName", () => {
  it("colapsa el doble punto final", () => {
    expect(tidyShortName("Lucía F..")).toBe("Lucía F.");
    expect(tidyShortName("Tomás R.")).toBe("Tomás R.");
  });
});

describe("open_expiring", () => {
  it("sin respuesta mantiene el paso 2 actual", () => {
    expect(buildStayChangeSteps("open_expiring", false).map((x) => x.state)).toEqual(["done", "current", "pending", "pending"]);
  });
  it("con respuesta avanza a buscar", () => {
    expect(buildStayChangeSteps("open_expiring", true).map((x) => x.state)).toEqual(["done", "done", "current", "pending"]);
  });
});
