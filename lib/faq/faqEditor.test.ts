import { describe, expect, it } from "vitest";
import {
  FAQ_BATCH_MAX_ITEMS,
  describeBatchProblems,
  isCatalogDraftDirty,
  parseFaqBatchInput,
  summarizeFaqBatch,
} from "./faqEditor";

describe("isCatalogDraftDirty", () => {
  const saved = { selected: false, answer: "Respuesta sugerida." };
  it("sin cambios no está sucio", () => {
    expect(isCatalogDraftDirty("residence", saved, saved)).toBe(false);
  });
  it("cambiar «Mostrar» ensucia cualquier pregunta", () => {
    expect(isCatalogDraftDirty("residence", { ...saved, selected: true }, saved)).toBe(true);
    expect(isCatalogDraftDirty("estured", { ...saved, selected: true }, saved)).toBe(true);
  });
  it("editar la respuesta ensucia solo las de la residencia", () => {
    expect(isCatalogDraftDirty("residence", { ...saved, answer: "Otra." }, saved)).toBe(true);
    expect(isCatalogDraftDirty("estured", { ...saved, answer: "Otra." }, saved)).toBe(false);
  });
  it("ignora espacios sobrantes y saltos de línea repetidos", () => {
    expect(isCatalogDraftDirty("residence", { ...saved, answer: "  Respuesta sugerida.  \n\n\n" }, saved)).toBe(false);
  });
});

describe("parseFaqBatchInput", () => {
  it("acepta catálogo y propias, y deduplica por id", () => {
    const r = parseFaqBatchInput({
      catalog: [
        { id: "FAQ-07", selected: true, answer: "Hola" },
        { id: "FAQ-07", selected: false, answer: "Repetida" },
        { id: "FAQ-09", selected: false },
      ],
      own: [{ question: "¿P?", answer: "R" }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.catalog).toEqual([
        { id: "FAQ-07", selected: true, answer: "Hola" },
        { id: "FAQ-09", selected: false, answer: "" },
      ]);
      expect(r.value.own).toHaveLength(1);
    }
  });
  it("own ausente o null significa «no tocar lo guardado»", () => {
    for (const input of [{ catalog: [] }, { catalog: [], own: null }]) {
      const r = parseFaqBatchInput(input);
      expect(r.ok && r.value.own).toBeNull();
    }
  });
  it("rechaza formas inválidas y el exceso de ítems", () => {
    expect(parseFaqBatchInput(null).ok).toBe(false);
    expect(parseFaqBatchInput("x").ok).toBe(false);
    expect(parseFaqBatchInput({ catalog: "x" }).ok).toBe(false);
    expect(parseFaqBatchInput({ catalog: [{ id: 5, selected: true }] }).ok).toBe(false);
    expect(parseFaqBatchInput({ catalog: [{ id: "FAQ-01", selected: "si" }] }).ok).toBe(false);
    expect(parseFaqBatchInput({ catalog: [{ id: "FAQ-01", selected: true, answer: 3 }] }).ok).toBe(false);
    expect(parseFaqBatchInput({ catalog: [], own: {} }).ok).toBe(false);
    const many = Array.from({ length: FAQ_BATCH_MAX_ITEMS + 1 }, (_, i) => ({ id: `FAQ-${i}`, selected: true }));
    expect(parseFaqBatchInput({ catalog: many }).ok).toBe(false);
  });
});

describe("summarizeFaqBatch", () => {
  const ok = { ok: true as const, selected: true };
  const bad = { ok: false as const, error: "x" };
  it("ok si nada falló", () => {
    expect(summarizeFaqBatch({ a: ok }, { ok: true })).toBe("ok");
    expect(summarizeFaqBatch({}, undefined)).toBe("ok");
  });
  it("partial si algo se guardó y algo no", () => {
    expect(summarizeFaqBatch({ a: ok, b: bad }, undefined)).toBe("partial");
    expect(summarizeFaqBatch({ a: ok }, { ok: false, error: "x" })).toBe("partial");
  });
  it("error si no se guardó nada", () => {
    expect(summarizeFaqBatch({ a: bad }, undefined)).toBe("error");
    expect(summarizeFaqBatch({}, { ok: false, error: "x" })).toBe("error");
  });
});

describe("describeBatchProblems", () => {
  it("nombra lo que falló", () => {
    expect(describeBatchProblems(1, false)).toContain("1 pregunta del catálogo");
    expect(describeBatchProblems(3, false)).toContain("3 preguntas del catálogo");
    expect(describeBatchProblems(0, true)).toContain("tus preguntas propias");
    expect(describeBatchProblems(2, true)).toContain("2 preguntas del catálogo y tus preguntas propias");
    expect(describeBatchProblems(0, false)).toBe("");
  });
});
