import { describe, expect, it } from "vitest";
import { ESSENTIAL_FAQ_IDS, countEssentialFaqsReady, isEssentialFaq } from "./catalog";

const q = (id: string, owner: "estured" | "residence", suggested_answer: string, selected: boolean, override: string | null = null) => ({
  id,
  owner,
  suggested_answer,
  selection: { is_selected: selected, answer_override: override },
});

describe("preguntas esenciales", () => {
  it("reconoce solo las esenciales", () => {
    expect(isEssentialFaq("FAQ-36")).toBe(true);
    expect(isEssentialFaq("FAQ-19")).toBe(false); // el depósito sale de datos estructurados de la ficha
    expect(new Set(ESSENTIAL_FAQ_IDS).size).toBe(ESSENTIAL_FAQ_IDS.length);
  });

  it("cuenta solo las elegidas y sin campos pendientes", () => {
    const entries = [
      q("FAQ-36", "residence", "Llevá {lista_de_que_llevar}.", true), // campos pendientes: no cuenta
      q("FAQ-42", "residence", "Avisá con {preaviso_egreso}.", true, "Avisá con 30 días."), // completada: cuenta
      q("FAQ-43", "residence", "Texto sin campos.", false), // no elegida: no cuenta
      q("FAQ-49", "estured", "Texto fijo.", true), // texto fijo elegido: cuenta
      q("FAQ-19", "residence", "No esencial.", true), // no esencial: no cuenta
    ];
    expect(countEssentialFaqsReady(entries)).toBe(2);
  });
});
