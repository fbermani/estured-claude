import { describe, expect, it } from "vitest";
import { buildAgeFacts } from "@/lib/residences/fichaAge";

const avg = { years: 23, residents: 14 };

describe("buildAgeFacts", () => {
  it("con tope de edad y promedio: rango en la franja y promedio de bajada", () => {
    const f = buildAgeFacts({ minAge: 18, maxAge: 30, acceptsMinors: false, average: avg });
    expect(f.rangeLabel).toBe("De 18 a 30 años");
    expect(f.strip).toEqual({ value: "18 a 30", unit: "años", sub: "promedio 23 años" });
  });

  it("con tope y sin promedio (comunidad chica): solo el rango, sin bajada", () => {
    const f = buildAgeFacts({ minAge: 18, maxAge: 28, acceptsMinors: false, average: null });
    expect(f.strip).toEqual({ value: "18 a 28", unit: "años" });
    expect(f.average).toBeNull();
  });

  it("sin tope pero con promedio: la franja muestra el promedio", () => {
    const f = buildAgeFacts({ minAge: 18, maxAge: null, acceptsMinors: false, average: avg });
    expect(f.rangeLabel).toBe("Desde 18 años");
    expect(f.hasCap).toBe(false);
    expect(f.strip).toEqual({ value: "23", unit: "años", sub: "edad promedio" });
  });

  it("sin tope y sin promedio: no hay celda en la franja (el capítulo igual dice «Desde 18 años»)", () => {
    const f = buildAgeFacts({ minAge: 18, maxAge: null, acceptsMinors: false, average: null });
    expect(f.strip).toBeNull();
    expect(f.rangeLabel).toBe("Desde 18 años");
  });

  it("sin la migración 0052 (min indefinido) no hay rango ni celda, aunque exista promedio", () => {
    const f = buildAgeFacts({ minAge: undefined, maxAge: undefined, acceptsMinors: undefined, average: null });
    expect(f.rangeLabel).toBeNull();
    expect(f.strip).toBeNull();
  });

  it("acepta menores: el rango sale desde la edad mínima que declaró", () => {
    expect(buildAgeFacts({ minAge: 16, maxAge: 25, acceptsMinors: true, average: null }).strip?.value).toBe("16 a 25");
  });
});

describe("buildAgeFacts: subtítulo de «La comunidad»", () => {
  it("rango y promedio juntos, con coma", () => {
    expect(buildAgeFacts({ minAge: 19, maxAge: 26, acceptsMinors: false, average: { years: 22, residents: 12 } }).subtitle).toBe(
      "De 19 a 26 años, promedio 22 años",
    );
  });
  it("solo rango", () => {
    expect(buildAgeFacts({ minAge: 18, maxAge: 30, acceptsMinors: false, average: null }).subtitle).toBe("De 18 a 30 años");
    expect(buildAgeFacts({ minAge: 18, maxAge: null, acceptsMinors: false, average: null }).subtitle).toBe("Desde 18 años");
  });
  it("sin la migración 0052 pero con promedio: solo el promedio; sin nada, sin subtítulo", () => {
    expect(buildAgeFacts({ minAge: undefined, maxAge: undefined, acceptsMinors: undefined, average: { years: 23, residents: 14 } }).subtitle).toBe(
      "Edad promedio 23 años",
    );
    expect(buildAgeFacts({ minAge: undefined, maxAge: undefined, acceptsMinors: undefined, average: null }).subtitle).toBeNull();
  });
});
