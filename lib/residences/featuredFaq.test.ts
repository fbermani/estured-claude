import { describe, expect, it } from "vitest";
import { FEATURED_FAQ_MAX, splitFeaturedFaq } from "@/lib/residences/featuredFaq";

const q = (n: number, extra: Record<string, unknown> = {}) => ({ question: `P${n}`, ...extra });

describe("splitFeaturedFaq (sin columna is_featured: las primeras por el orden actual)", () => {
  it("con más de 6 preguntas, destaca las 6 primeras y deja el resto en orden", () => {
    const items = Array.from({ length: 9 }, (_, i) => q(i + 1));
    const { featured, rest } = splitFeaturedFaq(items);
    expect(FEATURED_FAQ_MAX).toBe(6);
    expect(featured.map((x) => x.question)).toEqual(["P1", "P2", "P3", "P4", "P5", "P6"]);
    expect(rest.map((x) => x.question)).toEqual(["P7", "P8", "P9"]);
  });

  it("con 6 o menos, todas van a la banda y no queda resto", () => {
    const items = [q(1), q(2), q(3)];
    const { featured, rest } = splitFeaturedFaq(items);
    expect(featured).toHaveLength(3);
    expect(rest).toEqual([]);
  });

  it("sin preguntas devuelve todo vacío", () => {
    expect(splitFeaturedFaq([])).toEqual({ featured: [], rest: [] });
  });

  it("ninguna pregunta se pierde ni se repite", () => {
    const items = Array.from({ length: 11 }, (_, i) => q(i + 1));
    const { featured, rest } = splitFeaturedFaq(items);
    expect([...featured, ...rest].sort((a, b) => a.question.localeCompare(b.question, "es", { numeric: true }))).toEqual(items);
    expect(new Set([...featured, ...rest]).size).toBe(items.length);
  });
});

describe("splitFeaturedFaq (preparada para is_featured)", () => {
  it("si la residencia marcó destacadas, usa solo esas, por featuredOrder", () => {
    const items = [q(1), q(2, { isFeatured: true, featuredOrder: 2 }), q(3), q(4, { isFeatured: true, featuredOrder: 1 })];
    const { featured, rest } = splitFeaturedFaq(items);
    expect(featured.map((x) => x.question)).toEqual(["P4", "P2"]);
    expect(rest.map((x) => x.question)).toEqual(["P1", "P3"]);
  });

  it("respeta el máximo aunque haya más marcadas, y las que sobran van al resto", () => {
    const items = Array.from({ length: 8 }, (_, i) => q(i + 1, { isFeatured: true, featuredOrder: i + 1 }));
    const { featured, rest } = splitFeaturedFaq(items);
    expect(featured).toHaveLength(6);
    expect(rest.map((x) => x.question)).toEqual(["P7", "P8"]);
  });

  it("las marcadas sin orden quedan al final de las ordenadas, en su orden original", () => {
    const items = [q(1, { isFeatured: true }), q(2, { isFeatured: true, featuredOrder: 1 }), q(3, { isFeatured: true })];
    expect(splitFeaturedFaq(items).featured.map((x) => x.question)).toEqual(["P2", "P1", "P3"]);
  });

  it("isFeatured en false o null no cuenta como marca", () => {
    const items = [q(1, { isFeatured: false }), q(2, { isFeatured: null }), q(3)];
    expect(splitFeaturedFaq(items).featured).toHaveLength(3);
  });
});
