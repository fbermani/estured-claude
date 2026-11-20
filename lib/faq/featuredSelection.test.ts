import { describe, expect, it } from "vitest";
import { parseFeaturedRefs } from "@/lib/faq/featuredSelection";
import { FEATURED_FAQ_MAX, splitFeaturedFaq } from "@/lib/residences/featuredFaq";

describe("parseFeaturedRefs", () => {
  it("acepta una lista vacía (vuelve al comportamiento por defecto)", () => {
    expect(parseFeaturedRefs([])).toEqual({ ok: true, refs: [] });
  });
  it("conserva el orden recibido y los dos tipos", () => {
    const refs = [{ kind: "free", id: "11111111-1111-1111-1111-111111111111" }, { kind: "catalog", id: "FAQ-25" }];
    expect(parseFeaturedRefs(refs)).toEqual({ ok: true, refs });
  });
  it("acepta exactamente 6 y rechaza 7", () => {
    const six = Array.from({ length: FEATURED_FAQ_MAX }, (_, i) => ({ kind: "catalog", id: `FAQ-${10 + i}` }));
    expect(parseFeaturedRefs(six).ok).toBe(true);
    const r = parseFeaturedRefs([...six, { kind: "catalog", id: "FAQ-99" }]);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("6");
  });
  it("rechaza repetidas, tipos inválidos, ids vacíos o enormes y formas raras", () => {
    expect(parseFeaturedRefs([{ kind: "catalog", id: "FAQ-01" }, { kind: "catalog", id: "FAQ-01" }])).toMatchObject({ ok: false });
    expect(parseFeaturedRefs([{ kind: "fixed", id: "x" }])).toMatchObject({ ok: false });
    expect(parseFeaturedRefs([{ kind: "catalog", id: "" }])).toMatchObject({ ok: false });
    expect(parseFeaturedRefs([{ kind: "catalog", id: "a".repeat(65) }])).toMatchObject({ ok: false });
    expect(parseFeaturedRefs([{ kind: "catalog" }])).toMatchObject({ ok: false });
    expect(parseFeaturedRefs([null])).toMatchObject({ ok: false });
    expect(parseFeaturedRefs("FAQ-01")).toMatchObject({ ok: false });
    expect(parseFeaturedRefs(undefined)).toMatchObject({ ok: false });
  });
  it("el mismo id como catálogo y como libre son preguntas distintas", () => {
    expect(parseFeaturedRefs([{ kind: "catalog", id: "x" }, { kind: "free", id: "x" }]).ok).toBe(true);
  });
});

describe("la banda respeta lo que eligió la residencia", () => {
  it("con destacadas marcadas muestra solo esas, en su orden, y el resto va al acordeón", () => {
    const items = [
      { question: "a" },
      { question: "b", isFeatured: true, featuredOrder: 2 },
      { question: "c", isFeatured: true, featuredOrder: 1 },
      { question: "d", isFeatured: false, featuredOrder: null },
    ];
    const { featured, rest } = splitFeaturedFaq(items);
    expect(featured.map((q) => q.question)).toEqual(["c", "b"]);
    expect(rest.map((q) => q.question)).toEqual(["a", "d"]);
  });
  it("sin ninguna marcada destaca las primeras 6", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ question: `q${i}`, isFeatured: false, featuredOrder: null }));
    expect(splitFeaturedFaq(items).featured).toHaveLength(FEATURED_FAQ_MAX);
  });
});
