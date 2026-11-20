import { describe, expect, it } from "vitest";
import { ESSENTIAL_FAQ_IDS, sortEssentialFirst } from "./catalog";

describe("sortEssentialFirst", () => {
  it("pone las esenciales primero y conserva el orden del resto", () => {
    const list = ["FAQ-02", "FAQ-07", "FAQ-04", "FAQ-09", "FAQ-12"].map((id) => ({ id }));
    expect(sortEssentialFirst(list).map((e) => e.id)).toEqual(["FAQ-07", "FAQ-09", "FAQ-02", "FAQ-04", "FAQ-12"]);
  });

  it("es estable entre esenciales: respeta el orden de entrada", () => {
    const list = ["FAQ-36", "FAQ-07", "FAQ-25"].map((id) => ({ id }));
    expect(sortEssentialFirst(list).map((e) => e.id)).toEqual(["FAQ-36", "FAQ-07", "FAQ-25"]);
  });

  it("no pierde ni repite preguntas y no modifica la lista original", () => {
    const list = ESSENTIAL_FAQ_IDS.map((id) => ({ id })).reverse();
    const copy = [...list];
    const sorted = sortEssentialFirst([{ id: "FAQ-01" }, ...list, { id: "FAQ-02" }]);
    expect(sorted).toHaveLength(list.length + 2);
    expect(new Set(sorted.map((e) => e.id)).size).toBe(sorted.length);
    expect(list).toEqual(copy);
  });

  it("sin esenciales devuelve el mismo orden", () => {
    const list = ["FAQ-02", "FAQ-04"].map((id) => ({ id }));
    expect(sortEssentialFirst(list)).toEqual(list);
    expect(sortEssentialFirst([])).toEqual([]);
  });
});
