import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ageAtDate, ageRangeNotice, describeAgeRange, residenceAcceptsAge, validateAgeRange } from "@/lib/residences/age";
import { parseIngresoParam } from "@/lib/residences/studentAge";

describe("ageAtDate", () => {
  it("cuenta años cumplidos a la fecha de referencia", () => {
    expect(ageAtDate("2006-03-10", "2026-03-09")).toBe(19);
    expect(ageAtDate("2006-03-10", "2026-03-10")).toBe(20);
    expect(ageAtDate("2008-12-31", "2026-10-25")).toBe(17);
  });
  it("maneja el 29 de febrero", () => {
    expect(ageAtDate("2004-02-29", "2026-02-28")).toBe(21);
    expect(ageAtDate("2004-02-29", "2026-03-01")).toBe(22);
  });
  it("devuelve null con fechas faltantes o inválidas o nacimiento futuro", () => {
    expect(ageAtDate(null, "2026-10-25")).toBeNull();
    expect(ageAtDate("", "2026-10-25")).toBeNull();
    expect(ageAtDate("2006-02-30", "2026-10-25")).toBeNull();
    expect(ageAtDate("2030-01-01", "2026-10-25")).toBeNull();
  });
});

describe("residenceAcceptsAge", () => {
  const base = { minResidentAge: 18, maxResidentAge: null, acceptsMinors: false };
  it("sin fecha de nacimiento nunca excluye", () => {
    expect(residenceAcceptsAge({ minResidentAge: 25, maxResidentAge: 30, acceptsMinors: false }, null)).toBe(true);
  });
  it("respeta mínimo y máximo (inclusivos)", () => {
    const r = { ...base, minResidentAge: 20, maxResidentAge: 25 };
    expect(residenceAcceptsAge(r, 19)).toBe(false);
    expect(residenceAcceptsAge(r, 20)).toBe(true);
    expect(residenceAcceptsAge(r, 25)).toBe(true);
    expect(residenceAcceptsAge(r, 26)).toBe(false);
  });
  it("un menor solo entra si la residencia acepta menores y su edad alcanza el mínimo", () => {
    expect(residenceAcceptsAge(base, 17)).toBe(false);
    expect(residenceAcceptsAge({ minResidentAge: 16, maxResidentAge: null, acceptsMinors: true }, 17)).toBe(true);
    expect(residenceAcceptsAge({ minResidentAge: 16, maxResidentAge: null, acceptsMinors: true }, 15)).toBe(false);
  });
  it("sin reglas cargadas (migración sin aplicar) acepta mayores de 18", () => {
    const none = { minResidentAge: undefined, maxResidentAge: undefined, acceptsMinors: undefined };
    expect(residenceAcceptsAge(none, 18)).toBe(true);
    expect(residenceAcceptsAge(none, 17)).toBe(false);
  });
});

describe("validateAgeRange", () => {
  it("acepta los valores por defecto y vacíos", () => {
    expect(validateAgeRange({ minAge: "", maxAge: "", acceptsMinors: false })).toEqual({
      ok: true,
      value: { minResidentAge: 18, maxResidentAge: null, acceptsMinors: false },
    });
  });
  it("rechaza mínimo menor a 18 sin aceptar menores", () => {
    expect(validateAgeRange({ minAge: 16, maxAge: null, acceptsMinors: false }).ok).toBe(false);
    expect(validateAgeRange({ minAge: 16, maxAge: null, acceptsMinors: true }).ok).toBe(true);
  });
  it("rechaza máximo menor que el mínimo, fuera de rango o no entero", () => {
    expect(validateAgeRange({ minAge: 25, maxAge: 20, acceptsMinors: false }).ok).toBe(false);
    expect(validateAgeRange({ minAge: 18, maxAge: 120, acceptsMinors: false }).ok).toBe(false);
    expect(validateAgeRange({ minAge: 18.5, maxAge: null, acceptsMinors: false }).ok).toBe(false);
    expect(validateAgeRange({ minAge: "abc", maxAge: null, acceptsMinors: false }).ok).toBe(false);
    expect(validateAgeRange({ minAge: 5, maxAge: null, acceptsMinors: true }).ok).toBe(false);
  });
});

describe("describeAgeRange / parseIngresoParam", () => {
  it("describe el rango público", () => {
    expect(describeAgeRange({ minResidentAge: 18, maxResidentAge: null, acceptsMinors: false })).toBe("Desde 18 años");
    expect(describeAgeRange({ minResidentAge: 18, maxResidentAge: 30, acceptsMinors: false })).toBe("De 18 a 30 años");
  });
  it("valida el parámetro ingreso", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(parseIngresoParam("2027-03-01", now)).toBe("2027-03-01");
    expect(parseIngresoParam("2027-02-30", now)).toBeNull();
    expect(parseIngresoParam("mañana", now)).toBeNull();
    expect(parseIngresoParam("2040-01-01", now)).toBeNull();
    expect(parseIngresoParam(undefined, now)).toBeNull();
  });
});

import { todayIso } from "@/lib/residences/age";

describe("todayIso (zona Buenos Aires)", () => {
  it("usa la fecha de Buenos Aires, no UTC", () => {
    // 01:30 UTC del 26/10 = 22:30 del 25/10 en Buenos Aires (UTC-3)
    expect(todayIso(new Date("2026-10-26T01:30:00Z"))).toBe("2026-10-25");
    expect(todayIso(new Date("2026-10-26T03:00:00Z"))).toBe("2026-10-26");
  });
});

describe("bordes exactos de min/max", () => {
  const rule = { minResidentAge: 20, maxResidentAge: 30, acceptsMinors: false };
  it("incluye min y max exactos y excluye uno afuera", () => {
    expect(residenceAcceptsAge(rule, 19)).toBe(false);
    expect(residenceAcceptsAge(rule, 20)).toBe(true);
    expect(residenceAcceptsAge(rule, 30)).toBe(true);
    expect(residenceAcceptsAge(rule, 31)).toBe(false);
  });
  it("menores solo si la residencia los acepta y cumplen el mínimo", () => {
    expect(residenceAcceptsAge({ minResidentAge: 16, maxResidentAge: null, acceptsMinors: true }, 16)).toBe(true);
    expect(residenceAcceptsAge({ minResidentAge: 16, maxResidentAge: null, acceptsMinors: true }, 15)).toBe(false);
  });
});

describe("parseIngresoParam", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  it("acepta fechas válidas hasta 3 años a futuro", () => {
    expect(parseIngresoParam("2027-03-01", now)).toBe("2027-03-01");
    expect(parseIngresoParam("2029-10-25", now)).toBe("2029-10-25");
  });
  it("rechaza formato inválido, fechas imposibles y muy futuras", () => {
    expect(parseIngresoParam(undefined, now)).toBeNull();
    expect(parseIngresoParam("25/10/2026", now)).toBeNull();
    expect(parseIngresoParam("2026-02-30", now)).toBeNull();
    expect(parseIngresoParam("2029-10-26", now)).toBeNull();
  });
});

describe("ageRangeNotice (DR50)", () => {
  const rule = { minResidentAge: 18, maxResidentAge: 26, acceptsMinors: false };
  it("menor de 17 con ficha «De 18 a 26»: avisa con la edad a la fecha de ingreso", () => {
    const msg = ageRangeNotice(rule, "2009-05-10", "2026-12-01");
    expect(msg).toContain("17 años");
    expect(msg).toContain("de 18 a 26 años");
  });
  it("cumple 18 antes del ingreso: no avisa", () => {
    expect(ageRangeNotice(rule, "2009-05-10", "2027-06-01")).toBeNull();
  });
  it("sin fecha de ingreso o sin nacimiento: no avisa", () => {
    expect(ageRangeNotice(rule, "2009-05-10", "")).toBeNull();
    expect(ageRangeNotice(rule, null, "2026-12-01")).toBeNull();
  });
  it("pasa el máximo: avisa", () => {
    expect(ageRangeNotice(rule, "1995-01-01", "2026-12-01")).toContain("31 años");
  });
});
