import { describe, expect, it } from "vitest";
import { SERVICE_OPTIONS } from "@/lib/residences/options";
import { mergeByTemplate, sanitizeProfileDraft, sanitizeRoomTypes, saveImpactNote, toProfileDraftData, type ProfileDraftSource } from "@/lib/residences/profileDraft";

function source(patch: Partial<ProfileDraftSource> = {}): ProfileDraftSource {
  return {
    tagline: "Casa",
    description: "",
    services: new Set(["b", "a"]),
    commonAreas: new Set<string>(),
    kitchens: 1,
    cleaningMode: "daily",
    cleaningPerWeek: 3,
    nearUniversities: new Set<string>(),
    stayDocKeys: new Set<string>(),
    stayDocOther: [],
    rulesRows: [{ lead: "", title: "Silencio", detail: "" }],
    rulesDirty: true,
    customItems: [],
    faqItems: [{ question: "", answer: "" }],
    roomTypes: [{ name: "Individual", features: [], roomCount: 1, capacityPerRoom: 1, monthlyPriceUsd: 300 }],
    conditions: { minimumStayMonths: 3 },
    ...patch,
  };
}

describe("toProfileDraftData", () => {
  it("ordena los conjuntos: el mismo contenido da la misma foto sin importar el orden de inserción", () => {
    const a = toProfileDraftData(source({ services: new Set(["x", "y"]) }));
    const b = toProfileDraftData(source({ services: new Set(["y", "x"]) }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("solo guarda los ítems «Otro» nuevos (sin id)", () => {
    const d = toProfileDraftData(
      source({
        customItems: [
          { id: "1", kind: "service", label: "Ya guardado" },
          { kind: "area", label: "Terraza nueva" },
        ],
      }),
    );
    expect(d.newCustomItems).toEqual([{ kind: "area", label: "Terraza nueva" }]);
  });
  it("no comparte referencias con el formulario", () => {
    const rooms = [{ name: "Doble" }];
    const d = toProfileDraftData(source({ roomTypes: rooms }));
    (d.roomTypes[0] as { name: string }).name = "Otra";
    expect(rooms[0].name).toBe("Doble");
  });
});

describe("sanitizeProfileDraft", () => {
  it("rechaza lo que no es objeto o no trae nada válido", () => {
    expect(sanitizeProfileDraft(null)).toBeNull();
    expect(sanitizeProfileDraft("texto")).toBeNull();
    expect(sanitizeProfileDraft([])).toBeNull();
    expect(sanitizeProfileDraft({ otraCosa: 1 })).toBeNull();
  });
  it("conserva los campos válidos y descarta los de tipo equivocado", () => {
    const r = sanitizeProfileDraft({ tagline: "Hola", description: 5, kitchens: "2", cleaningMode: "monthly", rulesDirty: true });
    expect(r).toEqual({ tagline: "Hola", rulesDirty: true });
  });
  it("filtra servicios desconocidos y recorta las listas", () => {
    const first = SERVICE_OPTIONS[0];
    const r = sanitizeProfileDraft({ services: [first, "inexistente", 4] });
    expect(r?.services).toEqual([first]);
  });
  it("limita FAQ a 5 y reglas principales a 6", () => {
    const faq = Array.from({ length: 9 }, (_, i) => ({ question: `p${i}`, answer: `r${i}` }));
    const rules = Array.from({ length: 9 }, (_, i) => ({ lead: "", title: `t${i}`, detail: "" }));
    const r = sanitizeProfileDraft({ faqItems: faq, rulesRows: rules });
    expect(r?.faqItems).toHaveLength(5);
    expect(r?.rulesRows).toHaveLength(6);
  });
  it("descarta ítems «Otro» vacíos o de tipo inválido", () => {
    const r = sanitizeProfileDraft({
      newCustomItems: [
        { kind: "service", label: "Bicicletero" },
        { kind: "area", label: "  " },
        { kind: "otro", label: "x" },
      ],
    });
    expect(r?.newCustomItems).toEqual([{ kind: "service", label: "Bicicletero" }]);
  });
});

describe("mergeByTemplate", () => {
  const base = { minimumStayMonths: 3 as number | "", adjustmentPolicy: "quarterly", depositEnabled: false, enrollmentDiscountUntil: "" };
  it("toma solo claves conocidas con el mismo tipo", () => {
    const r = mergeByTemplate({ minimumStayMonths: 6, adjustmentPolicy: 4, depositEnabled: true, intrusa: "x" }, base);
    expect(r).toEqual({ minimumStayMonths: 6, adjustmentPolicy: "quarterly", depositEnabled: true, enrollmentDiscountUntil: "" });
  });
  it("un campo numérico acepta la cadena vacía", () => {
    expect(mergeByTemplate({ minimumStayMonths: "" }, base).minimumStayMonths).toBe("");
  });
  it("sin objeto devuelve una copia de la base", () => {
    const r = mergeByTemplate(undefined, base);
    expect(r).toEqual(base);
    expect(r).not.toBe(base);
  });
});

describe("sanitizeRoomTypes", () => {
  const template = { name: "Individual", roomCount: 1, capacityPerRoom: 1, monthlyPriceUsd: 300 };
  it("completa con la plantilla lo que falta o viene mal", () => {
    const r = sanitizeRoomTypes([{ name: "Doble", features: "no-array", roomCount: "x", monthlyPriceUsd: 450, id: "abc" }], template);
    expect(r).toEqual([{ id: "abc", name: "Doble", features: [], roomCount: 1, capacityPerRoom: 1, monthlyPriceUsd: 450 }]);
  });
  it("ignora entradas que no son objetos y limita la cantidad", () => {
    const many = Array.from({ length: 30 }, () => ({ name: "Triple" }));
    expect(sanitizeRoomTypes([1, null, "x"], template)).toEqual([]);
    expect(sanitizeRoomTypes(many, template)).toHaveLength(12);
    expect(sanitizeRoomTypes("nada", template)).toBeUndefined();
  });
});

describe("saveImpactNote", () => {
  it("avisa que guardar manda a revisión solo en una residencia publicada", () => {
    expect(saveImpactNote("verified_active")).toMatch(/pendientes de aprobación/);
    for (const s of ["draft", "needs_changes", "pending_verification", "verification_expired"]) expect(saveImpactNote(s)).toBeNull();
  });
});
