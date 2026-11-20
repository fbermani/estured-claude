import { describe, expect, it } from "vitest";
import { MAX_RULE_ITEMS, moveItem, normalizeRuleItems, parseRuleItems, ruleItemsToSummary, sameRuleItems } from "@/lib/residences/ruleItems";

describe("normalizeRuleItems", () => {
  it("recorta, descarta filas vacías y conserva el orden", () => {
    const r = normalizeRuleItems([
      { lead: "  23 a 7 ", title: " Silencio ", detail: " Para música,  auriculares " },
      { lead: "", title: "", detail: "" },
      { title: "Mascotas", lead: "No" },
    ]);
    expect(r).toEqual({
      ok: true,
      items: [{ lead: "23 a 7", title: "Silencio", detail: "Para música, auriculares" }, { lead: "No", title: "Mascotas" }],
    });
  });
  it("una fila con dato o detalle pero sin título es un error accionable", () => {
    const r = normalizeRuleItems([{ lead: "No", title: "" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/título/);
  });
  it("límites de largo: 12 / 40 / 120", () => {
    expect(normalizeRuleItems([{ lead: "x".repeat(13), title: "a" }]).ok).toBe(false);
    expect(normalizeRuleItems([{ title: "x".repeat(41) }]).ok).toBe(false);
    expect(normalizeRuleItems([{ title: "a", detail: "x".repeat(121) }]).ok).toBe(false);
    expect(normalizeRuleItems([{ lead: "x".repeat(12), title: "x".repeat(40), detail: "x".repeat(120) }]).ok).toBe(true);
  });
  it("rechaza HTML, enlaces y emails", () => {
    expect(normalizeRuleItems([{ title: "<b>Silencio</b>" }]).ok).toBe(false);
    expect(normalizeRuleItems([{ title: "Silencio", detail: "Mirá www.sitio.com" }]).ok).toBe(false);
    expect(normalizeRuleItems([{ title: "Silencio", detail: "escribí a a@b.com" }]).ok).toBe(false);
  });
  it("más de 6 reglas es un error; 6 pasan; duplicados no cuentan", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Regla ${i + 1}` }));
    expect(MAX_RULE_ITEMS).toBe(6);
    expect(normalizeRuleItems(rows(7)).ok).toBe(false);
    expect(normalizeRuleItems(rows(6)).ok).toBe(true);
    const dup = normalizeRuleItems([{ title: "Silencio" }, { title: "silencio" }]);
    expect(dup).toEqual({ ok: true, items: [{ title: "Silencio" }] });
  });
  it("lo que no es una lista es un error", () => {
    expect(normalizeRuleItems("x").ok).toBe(false);
    expect(normalizeRuleItems(null).ok).toBe(false);
  });
  it("caracteres de control se limpian", () => {
    expect(normalizeRuleItems([{ title: "Si\u0000lencio\n" }])).toEqual({ ok: true, items: [{ title: "Si lencio" }] });
  });
});

describe("parseRuleItems (lectura tolerante)", () => {
  it("descarta lo mal formado y corta en 6", () => {
    const raw = [...Array.from({ length: 8 }, (_, i) => ({ title: `R${i}` })), null, "x"];
    expect(parseRuleItems(raw)).toHaveLength(6);
    expect(parseRuleItems([{ lead: "No" }, { title: 5 }])).toEqual([]);
    expect(parseRuleItems(undefined)).toEqual([]);
    expect(parseRuleItems({})).toEqual([]);
  });
});

describe("ruleItemsToSummary / sameRuleItems / moveItem", () => {
  const items = [{ lead: "23 a 7", title: "Silencio", detail: "Auriculares" }, { title: "Mascotas" }];
  it("deriva el resumen, una regla por línea", () => {
    expect(ruleItemsToSummary(items)).toBe("23 a 7 · Silencio: Auriculares\nMascotas");
  });
  it("compara por contenido", () => {
    expect(sameRuleItems(items, items.map((i) => ({ ...i })))).toBe(true);
    expect(sameRuleItems(items, items.slice(0, 1))).toBe(false);
  });
  it("mueve filas sin tocar la lista original y respeta los límites", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(list, 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 0, 3)).toBe(list);
    expect(list).toEqual(["a", "b", "c"]);
  });
});
