import { describe, expect, it } from "vitest";
import { computeCommunityStats, MIN_AGES_FOR_RANGE, MIN_PROFILES_FOR_STATS, type CommunityStatsCard } from "./communityStats";

const p = (extra: Partial<CommunityStatsCard> = {}): CommunityStatsCard => ({ kind: "profile", ...extra });

describe("computeCommunityStats", () => {
  it("el mínimo de perfiles es 3", () => {
    expect(MIN_PROFILES_FOR_STATS).toBe(3);
  });

  it("sin tarjetas o con menos de 3 perfiles visibles no devuelve cifras", () => {
    expect(computeCommunityStats([])).toBeNull();
    expect(computeCommunityStats([p({ age: 20, nationality: "Perú", career: "Derecho" }), p({ age: 22, nationality: "Chile", career: "Medicina" })])).toBeNull();
  });

  it("los placeholders no cuentan como perfiles visibles", () => {
    const cards: CommunityStatsCard[] = [
      p({ age: 20, nationality: "Perú", career: "Derecho" }),
      p({ age: 22, nationality: "Chile", career: "Medicina" }),
      { kind: "placeholder" },
      { kind: "placeholder" },
    ];
    expect(computeCommunityStats(cards)).toBeNull();
  });

  it("calcula países, rango de edades y carreras con 3 o más perfiles", () => {
    const stats = computeCommunityStats([
      p({ age: 19, nationality: "Argentina", career: "Derecho" }),
      p({ age: 23, nationality: "Perú", career: "Medicina" }),
      p({ age: 21, nationality: "Argentina", career: "Derecho" }),
      { kind: "placeholder" },
    ]);
    expect(stats).toEqual({ visibleProfiles: 3, countries: 2, ageRange: null, careers: 2 });
  });

  it("el rango de edades solo se publica con 5 o más aportes", () => {
    expect(MIN_AGES_FOR_RANGE).toBe(5);
    const mk = (ages: number[]) => ages.map((age) => p({ age, nationality: "Perú" }));
    expect(computeCommunityStats(mk([19, 20, 21, 22]))?.ageRange).toBeNull();
    expect(computeCommunityStats(mk([19, 20, 21, 22, 25]))?.ageRange).toEqual({ min: 19, max: 25 });
  });

  it("normaliza tildes, mayúsculas y espacios al contar distintos", () => {
    const stats = computeCommunityStats([
      p({ age: 20, nationality: "Perú", career: "Psicología" }),
      p({ age: 21, nationality: " peru ", career: "psicologia" }),
      p({ age: 22, nationality: "PERÚ", career: "  Psicología  " }),
    ]);
    expect(stats?.countries).toBe(1);
    expect(stats?.careers).toBe(1);
  });

  it("omite una cifra si menos de 3 perfiles aportan ese dato", () => {
    const stats = computeCommunityStats([
      p({ age: 20, nationality: "Perú" }),
      p({ age: 22, nationality: "Chile" }),
      p({ age: 25, nationality: "Chile", career: "Derecho" }),
    ]);
    expect(stats).toEqual({ visibleProfiles: 3, countries: 2, ageRange: null, careers: null });
  });

  it("ignora edades nulas o inválidas y no revela el rango si quedan menos de 3", () => {
    const stats = computeCommunityStats([
      p({ age: null, nationality: "Perú" }),
      p({ age: 0, nationality: "Chile" }),
      p({ age: 22, nationality: "Chile" }),
    ]);
    expect(stats?.ageRange).toBeNull();
    expect(stats?.countries).toBe(2);
  });

  it("si ninguna cifra alcanza el mínimo devuelve null (visitante: sin campos individuales)", () => {
    expect(computeCommunityStats([p(), p(), p()])).toBeNull();
  });
});
