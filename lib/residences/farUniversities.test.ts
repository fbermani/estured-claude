import { describe, expect, it } from "vitest";
import { findFarUniversities, newlyFarUniversities } from "@/lib/residences/farUniversities";

// Palermo (centro aprox.) vs. sedes del catálogo.
const palermo = { lat: -34.5895, lng: -58.4295 };

describe("findFarUniversities", () => {
  it("no alerta una sede cercana (Universidad de Palermo, < 2 km)", () => {
    expect(findFarUniversities(palermo, ["Universidad de Palermo (UP)"])).toEqual([]);
  });

  it("alerta una sede a más de 2 km y devuelve la distancia", () => {
    const far = findFarUniversities(palermo, ["Universidad de Palermo (UP)", "UBA - Facultad de Ingeniería"]);
    expect(far.map((u) => u.name)).toEqual(["UBA - Facultad de Ingeniería"]);
    expect(far[0].distanceKm).toBeGreaterThan(2);
  });

  it("ignora nombres que no están en el catálogo", () => {
    expect(findFarUniversities(palermo, ["Universidad Inventada"])).toEqual([]);
  });

  it("respeta un umbral propio", () => {
    expect(findFarUniversities(palermo, ["UBA - Facultad de Ingeniería"], 50)).toEqual([]);
  });
});

describe("newlyFarUniversities", () => {
  it("devuelve solo las que no estaban alertadas antes", () => {
    const prev = [{ name: "A", distanceKm: 3 }];
    const cur = [
      { name: "A", distanceKm: 3 },
      { name: "B", distanceKm: 4 },
    ];
    expect(newlyFarUniversities(cur, prev)).toEqual([{ name: "B", distanceKm: 4 }]);
    expect(newlyFarUniversities(cur, cur)).toEqual([]);
  });
});
