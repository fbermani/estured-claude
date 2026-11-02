import { describe, expect, it } from "vitest";
import { ALL_CHECKLIST_KEYS, ARRIVAL_CHECKLIST, CHECKLIST_TOTAL, checklistPercent, countChecked, isChecklistKey } from "./checklist";

describe("catálogo del checklist de llegada", () => {
  it("tiene entre 35 y 70 ítems", () => {
    expect(CHECKLIST_TOTAL).toBeGreaterThanOrEqual(35);
    expect(CHECKLIST_TOTAL).toBeLessThanOrEqual(70);
  });
  it("las keys son únicas y con formato estable", () => {
    expect(new Set(ALL_CHECKLIST_KEYS).size).toBe(ALL_CHECKLIST_KEYS.length);
    for (const k of ALL_CHECKLIST_KEYS) expect(k).toMatch(/^[a-z0-9_.-]{1,80}$/);
  });
  it("las categorías tienen ids únicos y al menos un ítem", () => {
    expect(new Set(ARRIVAL_CHECKLIST.map((c) => c.id)).size).toBe(ARRIVAL_CHECKLIST.length);
    for (const c of ARRIVAL_CHECKLIST) expect(c.items.length).toBeGreaterThan(0);
  });
  it("el copy no usa términos prohibidos", () => {
    const text = JSON.stringify(ARRIVAL_CHECKLIST).toLowerCase();
    expect(text).not.toContain("mediación");
    expect(text).not.toContain("garantizad");
    expect(text).not.toContain("whatsapp");
  });
  it("isChecklistKey, countChecked y checklistPercent", () => {
    expect(isChecklistKey(ALL_CHECKLIST_KEYS[0])).toBe(true);
    expect(isChecklistKey("inventada")).toBe(false);
    expect(isChecklistKey(5)).toBe(false);
    expect(countChecked([ALL_CHECKLIST_KEYS[0], ALL_CHECKLIST_KEYS[0], "x"])).toBe(1);
    expect(checklistPercent(ALL_CHECKLIST_KEYS)).toBe(100);
    expect(checklistPercent([])).toBe(0);
  });
});
