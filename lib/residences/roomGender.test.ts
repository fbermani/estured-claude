import { describe, expect, it } from "vitest";
import { effectiveRoomGender, inheritedGenderChange, summarizeTypeGenders, validateRoomGender } from "./roomGender";

describe("roomGender", () => {
  it("valida: compartida no puede quedar sin especificar", () => {
    expect(validateRoomGender("sin_especificar", 2).ok).toBe(false);
    expect(validateRoomGender("sin_especificar", 1).ok).toBe(true);
    expect(validateRoomGender("femenino", 3).ok).toBe(true);
    expect(validateRoomGender("otro", 1).ok).toBe(false);
  });
  it("efectivo: manda la habitación, degrada al tipo", () => {
    expect(effectiveRoomGender({ roomGender: "femenino", typePolicy: "solo_hombres", capacityPerRoom: 2 })).toBe("femenino");
    expect(effectiveRoomGender({ roomGender: undefined, typePolicy: "solo_hombres", capacityPerRoom: 2 })).toBe("masculino");
    expect(effectiveRoomGender({ roomGender: "sin_especificar", typePolicy: null, capacityPerRoom: 2 })).toBe("mixto");
    expect(effectiveRoomGender({ roomGender: undefined, typePolicy: null, capacityPerRoom: 1 })).toBe("sin_especificar");
  });
  it("resumen por tipo", () => {
    expect(summarizeTypeGenders(["masculino", "femenino"])).toBe("1 masculina, 1 femenina");
    expect(summarizeTypeGenders(["mixto", "mixto"])).toBe("mixta");
    expect(summarizeTypeGenders(["femenino", "femenino", "mixto"])).toBe("2 femeninas, 1 mixta");
    expect(summarizeTypeGenders(["sin_especificar"])).toBeNull();
    expect(summarizeTypeGenders([])).toBeNull();
  });
  it("propaga el cambio de género del tipo a lo heredado", () => {
    expect(inheritedGenderChange({ policy: "mixto", capacity: 2 }, { policy: "solo_mujeres", capacity: 2 })).toEqual({ from: "mixto", to: "femenino" });
    expect(inheritedGenderChange({ policy: "mixto", capacity: 2 }, { policy: "mixto", capacity: 2 })).toBeNull();
  });
});
