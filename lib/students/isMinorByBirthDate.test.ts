import { describe, expect, it } from "vitest";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";

// Instantes UTC; Buenos Aires = UTC-3.
const at = (iso: string) => new Date(iso);

describe("isMinorByBirthDate (H04)", () => {
  it("sin birth_date o inválida se trata como menor", () => {
    expect(isMinorByBirthDate(null)).toBe(true);
    expect(isMinorByBirthDate(undefined)).toBe(true);
    expect(isMinorByBirthDate("")).toBe(true);
    expect(isMinorByBirthDate("no-es-fecha")).toBe(true);
    expect(isMinorByBirthDate("2000-13-40")).toBe(true);
  });

  it("el día antes de cumplir 18 es menor y el día del cumpleaños es adulto", () => {
    expect(isMinorByBirthDate("2008-06-15", at("2026-06-14T15:00:00Z"))).toBe(true);
    expect(isMinorByBirthDate("2008-06-15", at("2026-06-15T15:00:00Z"))).toBe(false);
  });

  it("cumpleaños hoy, apenas empezado el día en Buenos Aires", () => {
    // 00:30 del 15/6 en BA = 03:30 UTC.
    expect(isMinorByBirthDate("2008-06-15", at("2026-06-15T03:30:00Z"))).toBe(false);
  });

  it("usa el día de Buenos Aires, no el de UTC", () => {
    // 22:00 del 14/6 en BA = 01:00 UTC del 15/6: en BA todavía es 14.
    expect(isMinorByBirthDate("2008-06-15", at("2026-06-15T01:00:00Z"))).toBe(true);
    // 23:59 del 14/6 en BA = 02:59 UTC del 15/6.
    expect(isMinorByBirthDate("2008-06-15", at("2026-06-15T02:59:00Z"))).toBe(true);
    // 00:00 del 15/6 en BA = 03:00 UTC.
    expect(isMinorByBirthDate("2008-06-15", at("2026-06-15T03:00:00Z"))).toBe(false);
  });

  it("nacido un 29/2: en año no bisiesto cumple el 1/3", () => {
    // 2008-02-29 -> 18 años en 2026 (no bisiesto).
    expect(isMinorByBirthDate("2008-02-29", at("2026-02-28T15:00:00Z"))).toBe(true);
    expect(isMinorByBirthDate("2008-02-29", at("2026-03-01T15:00:00Z"))).toBe(false);
  });

  it("en año bisiesto (2028) el 29/2 ya cuenta como día calendario", () => {
    expect(isMinorByBirthDate("2010-02-28", at("2028-02-28T15:00:00Z"))).toBe(false);
    expect(isMinorByBirthDate("2010-03-01", at("2028-02-29T15:00:00Z"))).toBe(true);
  });

  it("adulto claro y menor claro", () => {
    expect(isMinorByBirthDate("1990-01-01", at("2026-10-21T12:00:00Z"))).toBe(false);
    expect(isMinorByBirthDate("2012-01-01", at("2026-10-21T12:00:00Z"))).toBe(true);
  });
});
