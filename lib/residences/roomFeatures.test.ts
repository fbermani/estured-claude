import { describe, expect, it } from "vitest";
import {
  ROOM_FEATURE_OTHER_MAX_CHARS,
  joinRoomFeatures,
  normalizeCustomRoomFeature,
  sanitizeRoomFeatures,
  splitRoomFeatures,
  validateCustomRoomFeature,
} from "@/lib/residences/roomFeatures";

describe("validateCustomRoomFeature", () => {
  it("normaliza: recorta, junta espacios y pone la primera en mayúscula", () => {
    expect(validateCustomRoomFeature("  aire   acondicionado ")).toEqual({ ok: true, value: "Aire acondicionado" });
    expect(normalizeCustomRoomFeature("")).toBe("");
  });
  it("acepta hasta 2 palabras y rechaza 3", () => {
    expect(validateCustomRoomFeature("Baño propio").ok).toBe(true);
    expect(validateCustomRoomFeature("Aire muy frío")).toEqual({ ok: false, error: "Hasta 2 palabras." });
  });
  it("tope de caracteres", () => {
    expect(validateCustomRoomFeature("a".repeat(ROOM_FEATURE_OTHER_MAX_CHARS)).ok).toBe(true);
    expect(validateCustomRoomFeature("a".repeat(ROOM_FEATURE_OTHER_MAX_CHARS + 1)).ok).toBe(false);
  });
  it("sin HTML, enlaces ni símbolos", () => {
    for (const bad of ["<b>Hola</b>", "<script>", "a@b.com", "http://x.co", "Ver & ver", "{dato}", "Ok;"]) {
      expect(validateCustomRoomFeature(bad).ok).toBe(false);
    }
  });
  it("sin números largos (teléfonos)", () => {
    expect(validateCustomRoomFeature("11223344").ok).toBe(false);
    expect(validateCustomRoomFeature("Cama 2 plazas").ok).toBe(false); // 3 palabras
    expect(validateCustomRoomFeature("TV 32").ok).toBe(true);
  });
  it("vacío o solo espacios no vale", () => {
    expect(validateCustomRoomFeature("   ")).toEqual({ ok: false, error: "Escribí la característica." });
    expect(validateCustomRoomFeature(null).ok).toBe(false);
  });
  it("no repite una de la lista, sin importar mayúsculas ni tildes", () => {
    expect(validateCustomRoomFeature("ventana").ok).toBe(false);
    expect(validateCustomRoomFeature("BALCON").ok).toBe(false);
    expect(validateCustomRoomFeature("Ropero individual").ok).toBe(false);
  });
});

describe("splitRoomFeatures / joinRoomFeatures", () => {
  it("separa las de la lista de la propia y vuelve a armar lo mismo", () => {
    const features = ["Ventana", "Escritorio", "Aire acondicionado"];
    const { listed, custom } = splitRoomFeatures(features);
    expect(listed).toEqual(["Ventana", "Escritorio"]);
    expect(custom).toBe("Aire acondicionado");
    expect(joinRoomFeatures(listed, custom)).toEqual(features);
  });
  it("sin propia: custom null; texto vacío no se agrega", () => {
    expect(splitRoomFeatures(["Ventana"]).custom).toBeNull();
    expect(joinRoomFeatures(["Ventana"], "   ")).toEqual(["Ventana"]);
    expect(joinRoomFeatures(["Ventana"], null)).toEqual(["Ventana"]);
  });
});

describe("sanitizeRoomFeatures (servidor)", () => {
  it("deja pasar solo las de la lista, sin repetir", () => {
    expect(sanitizeRoomFeatures(["Ventana", "Ventana", "Balcón"])).toEqual({ ok: true, features: ["Ventana", "Balcón"] });
    expect(sanitizeRoomFeatures([])).toEqual({ ok: true, features: [] });
  });
  it("acepta una propia válida y la devuelve normalizada", () => {
    expect(sanitizeRoomFeatures(["Ventana", " aire  frío "])).toEqual({ ok: true, features: ["Ventana", "Aire frío"] });
  });
  it("rechaza más de una propia", () => {
    expect(sanitizeRoomFeatures(["Aire", "Frigobar"]).ok).toBe(false);
  });
  it("rechaza una propia inválida o que repite una de la lista", () => {
    expect(sanitizeRoomFeatures(["<b>x</b>"]).ok).toBe(false);
    expect(sanitizeRoomFeatures(["ventana"]).ok).toBe(false);
    expect(sanitizeRoomFeatures(["uno dos tres"]).ok).toBe(false);
  });
  it("lo que no es texto cuenta como inválido, nunca como válido", () => {
    expect(sanitizeRoomFeatures([5 as unknown as string]).ok).toBe(false);
  });
});
