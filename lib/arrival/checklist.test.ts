import { describe, expect, it } from "vitest";
import {
  ALL_CHECKLIST_KEYS,
  ARRIVAL_CHECKLIST,
  CHECKLIST_TOTAL,
  checklistPercent,
  countChecked,
  countEssentialChecked,
  ESSENTIAL_ITEMS,
  ESSENTIAL_TOTAL,
  isChecklistKey,
  REST_CHECKLIST,
} from "./checklist";

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
  it("fusionó los ítems solapados (claves retiradas)", () => {
    for (const k of ["dinero.comprobantes", "viaje.horario-llegada", "llevar.cama-bano"]) expect(isChecklistKey(k)).toBe(false);
    expect(isChecklistKey("doc.comprobante")).toBe(true);
  });
  it("marca entre 8 y 12 esenciales y se muestran aparte del resto", () => {
    expect(ESSENTIAL_TOTAL).toBeGreaterThanOrEqual(8);
    expect(ESSENTIAL_TOTAL).toBeLessThanOrEqual(12);
    const restKeys = REST_CHECKLIST.flatMap((c) => c.items.map((i) => i.key));
    expect(ESSENTIAL_ITEMS.every((i) => isChecklistKey(i.key) && !restKeys.includes(i.key))).toBe(true);
    expect(restKeys.length + ESSENTIAL_TOTAL).toBe(CHECKLIST_TOTAL);
    for (const c of REST_CHECKLIST) expect(c.items.length).toBeGreaterThan(0);
  });
  it("countEssentialChecked ignora duplicados y claves que no son esenciales", () => {
    const first = ESSENTIAL_ITEMS[0].key;
    const nonEssential = ALL_CHECKLIST_KEYS.find((k) => !ESSENTIAL_ITEMS.some((i) => i.key === k))!;
    expect(countEssentialChecked([first, first, nonEssential, "x"])).toBe(1);
    expect(countEssentialChecked(ALL_CHECKLIST_KEYS)).toBe(ESSENTIAL_TOTAL);
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
