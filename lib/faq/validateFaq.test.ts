import { describe, expect, it } from "vitest";
import {
  ANSWER_MAX,
  QUESTION_MAX,
  QUESTION_MIN,
  excerpt,
  normalizeFreeText,
  validateAnswer,
  validateQuestion,
} from "@/lib/faq/validateFaq";

describe("normalizeFreeText", () => {
  it("unifica saltos de línea, quita caracteres de control y recorta", () => {
    expect(normalizeFreeText("  hola\r\nmundo\u0000\u0007  ")).toBe("hola\nmundo");
  });
  it("colapsa líneas en blanco repetidas", () => {
    expect(normalizeFreeText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });
  it("tolera null/undefined", () => {
    expect(normalizeFreeText(null)).toBe("");
    expect(normalizeFreeText(undefined)).toBe("");
  });
  it("no altera HTML: lo escapa React al renderizar", () => {
    expect(normalizeFreeText("<b>hola</b>")).toBe("<b>hola</b>");
  });
});

describe("validateQuestion", () => {
  it("rechaza vacías y demasiado cortas", () => {
    expect(validateQuestion("").ok).toBe(false);
    expect(validateQuestion("   ¿Hola?   ").ok).toBe(false);
    expect(validateQuestion("x".repeat(QUESTION_MIN - 1)).ok).toBe(false);
  });
  it("acepta el largo mínimo y el máximo exactos", () => {
    expect(validateQuestion("x".repeat(QUESTION_MIN)).ok).toBe(true);
    expect(validateQuestion("x".repeat(QUESTION_MAX)).ok).toBe(true);
  });
  it("rechaza lo que pasa el máximo", () => {
    const r = validateQuestion("x".repeat(QUESTION_MAX + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(QUESTION_MAX));
  });
  it("devuelve el texto normalizado", () => {
    const r = validateQuestion("  ¿Se aceptan mascotas?  ");
    expect(r).toEqual({ ok: true, value: "¿Se aceptan mascotas?" });
  });
});

describe("validateAnswer", () => {
  it("rechaza vacía y acepta hasta el máximo", () => {
    expect(validateAnswer("   ").ok).toBe(false);
    expect(validateAnswer("Sí.").ok).toBe(true);
    expect(validateAnswer("x".repeat(ANSWER_MAX)).ok).toBe(true);
    expect(validateAnswer("x".repeat(ANSWER_MAX + 1)).ok).toBe(false);
  });
});

describe("excerpt", () => {
  it("no toca textos cortos y recorta los largos con puntos suspensivos", () => {
    expect(excerpt("hola   mundo")).toBe("hola mundo");
    const out = excerpt("palabra ".repeat(40), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("…")).toBe(true);
  });
});
