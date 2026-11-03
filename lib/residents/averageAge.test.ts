import { describe, expect, it } from "vitest";
import { ageFromBirthDate, averageResidentAge, MIN_RESIDENTS_FOR_AVERAGE } from "./averageAge";

const NOW = new Date("2026-11-03T15:00:00Z");

describe("ageFromBirthDate", () => {
  it("cuenta años cumplidos al día de hoy en Buenos Aires", () => {
    expect(ageFromBirthDate("2005-11-03", NOW)).toBe(21);
    expect(ageFromBirthDate("2005-11-04", NOW)).toBe(20);
  });
  it("fechas ausentes, inválidas o futuras dan null", () => {
    expect(ageFromBirthDate(null, NOW)).toBeNull();
    expect(ageFromBirthDate("no-es-fecha", NOW)).toBeNull();
    expect(ageFromBirthDate("2030-01-01", NOW)).toBeNull();
  });
});

describe("averageResidentAge", () => {
  const born = (year: number, n: number) => Array.from({ length: n }, () => `${year}-01-01`);
  it("no publica el promedio con 10 residentes o menos", () => {
    expect(averageResidentAge(born(2005, MIN_RESIDENTS_FOR_AVERAGE), NOW)).toBeNull();
    expect(averageResidentAge(born(2005, 3), NOW)).toBeNull();
  });
  it("con más de 10 calcula el promedio redondeado", () => {
    const dates = [...born(2005, 6), ...born(2003, 5)]; // 21 y 23 → (6×21 + 5×23) / 11 ≈ 21,9
    expect(averageResidentAge(dates, NOW)).toEqual({ years: 22, residents: 11 });
  });
  it("las fechas inválidas no cuentan para el mínimo", () => {
    expect(averageResidentAge([...born(2005, 10), null, "x"], NOW)).toBeNull();
  });
});
