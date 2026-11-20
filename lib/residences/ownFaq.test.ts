import { describe, expect, it } from "vitest";
import { OWN_FAQ_ANSWER_MAX, OWN_FAQ_MAX, OWN_FAQ_QUESTION_MAX, dropBlankOwnFaq, normalizeOwnFaqItems, parseOwnFaqField } from "@/lib/residences/ownFaq";

describe("normalizeOwnFaqItems", () => {
  it("recorta, descarta pares incompletos y respeta los máximos de texto", () => {
    const r = normalizeOwnFaqItems([
      { question: "  ¿Mascotas?  ", answer: " No " },
      { question: "Sin respuesta", answer: "  " },
      { question: "q".repeat(OWN_FAQ_QUESTION_MAX + 50), answer: "a".repeat(OWN_FAQ_ANSWER_MAX + 50) },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ question: "¿Mascotas?", answer: "No" });
    expect(r[1].question).toHaveLength(OWN_FAQ_QUESTION_MAX);
    expect(r[1].answer).toHaveLength(OWN_FAQ_ANSWER_MAX);
  });
  it("corta en el tope vigente", () => {
    const many = Array.from({ length: OWN_FAQ_MAX + 3 }, (_, i) => ({ question: `P${i}`, answer: `R${i}` }));
    expect(normalizeOwnFaqItems(many)).toHaveLength(OWN_FAQ_MAX);
  });
  it("lo que no es una lista da una lista vacía", () => {
    expect(normalizeOwnFaqItems(null)).toEqual([]);
    expect(normalizeOwnFaqItems({})).toEqual([]);
    expect(normalizeOwnFaqItems([null, 5])).toEqual([]);
  });
});

describe("parseOwnFaqField", () => {
  it("campo ausente = null (no se toca lo guardado, nunca se borra)", () => {
    expect(parseOwnFaqField(null)).toBeNull();
  });
  it("campo presente se interpreta; JSON roto da lista vacía", () => {
    expect(parseOwnFaqField(JSON.stringify([{ question: "A", answer: "B" }]))).toEqual([{ question: "A", answer: "B" }]);
    expect(parseOwnFaqField("[]")).toEqual([]);
    expect(parseOwnFaqField("{no")).toEqual([]);
  });
});

describe("dropBlankOwnFaq", () => {
  it("saca el casillero en blanco de un borrador viejo y deja los que tienen algo", () => {
    expect(dropBlankOwnFaq([{ question: "", answer: "" }])).toEqual([]);
    expect(dropBlankOwnFaq([{ question: "A", answer: "" }, { question: " ", answer: " " }])).toEqual([{ question: "A", answer: "" }]);
  });
});
