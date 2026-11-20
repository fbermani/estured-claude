import { describe, expect, it } from "vitest";
import {
  OWN_FAQ_ANSWER_MAX,
  OWN_FAQ_MAX,
  OWN_FAQ_QUESTION_MAX,
  dropBlankOwnFaq,
  normalizeOwnFaqItems,
  ownFaqDirty,
  parseOwnFaqField,
  validateOwnFaqItems,
} from "@/lib/residences/ownFaq";

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

describe("validateOwnFaqItems", () => {
  it("normaliza y acepta pares completos; ignora los casilleros vacíos", () => {
    const r = validateOwnFaqItems([
      { question: "  ¿Se puede\n usar parlante? ", answer: " No, después de las 23. " },
      { question: "", answer: "  " },
    ]);
    expect(r).toEqual({ ok: true, items: [{ question: "¿Se puede usar parlante?", answer: "No, después de las 23." }] });
  });
  it("una lista vacía es válida (quita todas)", () => {
    expect(validateOwnFaqItems([])).toEqual({ ok: true, items: [] });
  });
  it("un par a medias da error con su número", () => {
    const sinRespuesta = validateOwnFaqItems([{ question: "¿Ok?", answer: "Sí" }, { question: "¿Y esto?", answer: "" }]);
    expect(sinRespuesta.ok).toBe(false);
    if (!sinRespuesta.ok) expect(sinRespuesta.error).toContain("pregunta propia 2");
    const sinPregunta = validateOwnFaqItems([{ question: " ", answer: "Algo" }]);
    expect(sinPregunta.ok).toBe(false);
  });
  it("no recorta en silencio: avisa si un texto pasa el máximo", () => {
    expect(validateOwnFaqItems([{ question: "q".repeat(OWN_FAQ_QUESTION_MAX + 1), answer: "a" }]).ok).toBe(false);
    expect(validateOwnFaqItems([{ question: "q", answer: "a".repeat(OWN_FAQ_ANSWER_MAX + 1) }]).ok).toBe(false);
    expect(validateOwnFaqItems([{ question: "q".repeat(OWN_FAQ_QUESTION_MAX), answer: "a".repeat(OWN_FAQ_ANSWER_MAX) }]).ok).toBe(true);
  });
  it("respeta el tope de preguntas propias", () => {
    const many = Array.from({ length: OWN_FAQ_MAX + 1 }, (_, i) => ({ question: `P${i}`, answer: `R${i}` }));
    expect(validateOwnFaqItems(many).ok).toBe(false);
    expect(validateOwnFaqItems(many.slice(0, OWN_FAQ_MAX)).ok).toBe(true);
  });
  it("lo que no es una lista es un error", () => {
    expect(validateOwnFaqItems(null).ok).toBe(false);
    expect(validateOwnFaqItems({}).ok).toBe(false);
  });
});

describe("ownFaqDirty", () => {
  const saved = [{ question: "¿Mascotas?", answer: "No" }];
  it("lo igual (con espacios sobrantes o casilleros vacíos) no está sucio", () => {
    expect(ownFaqDirty([{ question: " ¿Mascotas? ", answer: "No " }, { question: "", answer: "" }], saved)).toBe(false);
    expect(ownFaqDirty([], [])).toBe(false);
  });
  it("agregar, editar o quitar ensucia, también un par a medias", () => {
    expect(ownFaqDirty([...saved, { question: "Otra", answer: "Sí" }], saved)).toBe(true);
    expect(ownFaqDirty([{ question: "¿Mascotas?", answer: "Sí" }], saved)).toBe(true);
    expect(ownFaqDirty([], saved)).toBe(true);
    expect(ownFaqDirty([...saved, { question: "Solo pregunta", answer: "" }], saved)).toBe(true);
  });
});
