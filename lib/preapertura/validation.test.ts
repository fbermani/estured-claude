import { describe, expect, it } from "vitest";
import {
  checkBirthDate,
  isPlausibleEmail,
  nextEntryYear,
  normalizeEmail,
  parseIsoDate,
  profileProgress,
  validateProfile,
} from "@/lib/preapertura/validation";

// Mediodía en Buenos Aires (UTC-3) del 8/11/2026: el calendario de Argentina y el UTC coinciden.
const NOW = new Date("2026-11-08T15:00:00.000Z");

describe("parseIsoDate", () => {
  it("acepta solo YYYY-MM-DD de calendario real", () => {
    expect(parseIsoDate("2000-02-29")).toBe("2000-02-29");
    expect(parseIsoDate("2001-02-29")).toBeNull();
    expect(parseIsoDate("2000-13-01")).toBeNull();
    expect(parseIsoDate("31/12/2000")).toBeNull();
    expect(parseIsoDate("1850-01-01")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });
});

describe("checkBirthDate (18+ para cuenta propia, DR43.2)", () => {
  it("un adulto entra con su edad real", () => {
    expect(checkBirthDate("2000-01-01", { invited: false, now: NOW })).toEqual({ kind: "ok", birthDate: "2000-01-01", age: 26, isMinor: false });
  });

  it("cumplir 18 hoy ya es adulto; faltando un día, no", () => {
    expect(checkBirthDate("2008-11-08", { invited: false, now: NOW })).toMatchObject({ kind: "ok", age: 18, isMinor: false });
    expect(checkBirthDate("2008-11-09", { invited: false, now: NOW })).toEqual({ kind: "minor_blocked", age: 17 });
  });

  it("un menor sin invitación no crea cuenta (ni siquiera uno muy chico)", () => {
    expect(checkBirthDate("2010-05-02", { invited: false, now: NOW })).toEqual({ kind: "minor_blocked", age: 16 });
    expect(checkBirthDate("2018-05-02", { invited: false, now: NOW })).toMatchObject({ kind: "minor_blocked" });
  });

  it("con invitación un menor de 14 a 17 entra, marcado como menor", () => {
    expect(checkBirthDate("2010-05-02", { invited: true, now: NOW })).toEqual({ kind: "ok", birthDate: "2010-05-02", age: 16, isMinor: true });
    expect(checkBirthDate("2012-11-08", { invited: true, now: NOW })).toMatchObject({ kind: "ok", age: 14, isMinor: true });
  });

  it("con invitación, menos de 14 sigue siendo inválido", () => {
    expect(checkBirthDate("2012-11-09", { invited: true, now: NOW })).toMatchObject({ kind: "invalid" });
  });

  it("fechas imposibles, futuras o absurdas son inválidas", () => {
    for (const raw of ["", "hola", "2000-02-31", "2030-01-01", "1900-01-01", "1930-01-01"]) {
      expect(checkBirthDate(raw, { invited: false, now: NOW }).kind).toBe("invalid");
    }
  });
});

describe("email", () => {
  it("normaliza y valida forma básica", () => {
    expect(normalizeEmail("  Lucia@Gmail.COM ")).toBe("lucia@gmail.com");
    expect(isPlausibleEmail("lucia@gmail.com")).toBe(true);
    expect(isPlausibleEmail("lucia@gmail")).toBe(false);
    expect(isPlausibleEmail("a b@c.com")).toBe(false);
    expect(isPlausibleEmail(`${"a".repeat(250)}@x.com`)).toBe(false);
  });
});

describe("nextEntryYear (próxima temporada, DR43.3)", () => {
  it("en noviembre de 2026, enero a abril es 2027", () => {
    for (const month of [1, 2, 3, 4]) expect(nextEntryYear(month, NOW)).toBe(2027);
  });
  it("antes de ese mes en el mismo año, es el año corriente", () => {
    expect(nextEntryYear(4, new Date("2026-02-10T15:00:00.000Z"))).toBe(2026);
    expect(nextEntryYear(2, new Date("2026-02-10T15:00:00.000Z"))).toBe(2027);
  });
});

describe("validateProfile", () => {
  const adult = { isMinor: false, now: NOW };

  const complete = { first_name: "Lu", country: "Chile", university: "UBA", career: "Derecho", entry: "3", room_type: "any" };

  it("sin los obligatorios marca cada campo (DR67)", () => {
    const r = validateProfile({}, adult);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors).toEqual({
        first_name: "Completá tu nombre.", country: "Elegí tu país.", university: "Elegí tu universidad.",
        career: "Elegí tu carrera.", entry: "Elegí el mes de ingreso.", room_type: "Elegí el tipo de habitación.",
      });
    }
  });

  it("hábitos, intereses y comunidad son opcionales", () => {
    expect(validateProfile(complete, adult)).toMatchObject({ ok: true, value: { habits: [], interests: [], consentComunidad: false } });
  });

  it("un valor inválido conserva su mensaje; «Otra carrera» vacía marca solo el campo de texto", () => {
    expect(validateProfile({ ...complete, country: "Narnia" }, adult)).toMatchObject({ ok: false, fieldErrors: { country: "Elegí un país de la lista." } });
    const other = validateProfile({ ...complete, career: "__otra__", career_other: "" }, adult);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(Object.keys(other.fieldErrors)).toEqual(["career_other"]);
  });

  it("perfil completo con provincia, mes, residencia actual y comunidad", () => {
    const result = validateProfile(
      {
        first_name: "  Lucía ",
        country: "Argentina",
        province: "Salta",
        university: "UBA",
        career: "Medicina",
        entry: "3",
        room_type: "shared",
        habits: ["Madrugo", "Estudio en silencio"],
        interests: ["Lectura", "Viajes"],
        in_residence: "si",
        current_residence: "Residencia Norte",
        community: "on",
      },
      adult,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        firstName: "Lucía",
        country: "Argentina",
        province: "Salta",
        university: "UBA",
        career: "Medicina",
        entryMonth: 3,
        entryYear: 2027,
        entryUnsure: false,
        roomType: "shared",
        habits: ["Madrugo", "Estudio en silencio"],
        interests: ["Lectura", "Viajes"],
        currentResidence: "Residencia Norte",
        consentComunidad: true,
      },
    });
  });

  it("la provincia solo cuenta con Argentina", () => {
    const result = validateProfile({ ...complete, country: "Uruguay", province: "Salta" }, adult);
    expect(result).toMatchObject({ ok: true, value: { country: "Uruguay", province: null } });
  });

  it("«Todavía no sé» no guarda mes ni año", () => {
    expect(validateProfile({ ...complete, entry: "unsure" }, adult)).toMatchObject({ ok: true, value: { entryMonth: null, entryYear: null, entryUnsure: true } });
  });

  it("rechaza valores fuera de las listas cerradas", () => {
    for (const raw of [
      { country: "Narnia" },
      { country: "Argentina", province: "Atlántida" },
      { entry: "7" },
      { entry: "5" },
      { room_type: "suite" },
      { career: "Brujería" },
      { habits: ["Madrugo", "Inventado"] },
      { interests: ["Skydiving"] },
    ]) {
      const result = validateProfile({ ...complete, ...raw }, adult);
      expect(result.ok, JSON.stringify(raw)).toBe(false);
    }
  });

  it("máximo 2 hábitos y 2 intereses", () => {
    const habits = validateProfile({ ...complete, habits: ["Madrugo", "No fumo", "Hago deporte"] }, adult);
    expect(habits).toMatchObject({ ok: false, fieldErrors: { habits: "Elegí hasta 2." } });
    const interests = validateProfile({ ...complete, interests: ["Cine", "Series", "Arte"] }, adult);
    expect(interests).toMatchObject({ ok: false, fieldErrors: { interests: "Elegí hasta 2." } });
  });

  it("los repetidos no cuentan dos veces", () => {
    expect(validateProfile({ ...complete, habits: ["Madrugo", "Madrugo"] }, adult)).toMatchObject({ ok: true, value: { habits: ["Madrugo"] } });
  });

  it("longitudes y caracteres", () => {
    expect(validateProfile({ ...complete, first_name: "A".repeat(61) }, adult).ok).toBe(false);
    expect(validateProfile({ ...complete, first_name: "<script>" }, adult).ok).toBe(false);
    expect(validateProfile({ ...complete, first_name: "María José" }, adult).ok).toBe(true);
    expect(validateProfile({ ...complete, university: "U" }, adult).ok).toBe(false);
    expect(validateProfile({ ...complete, university: "x".repeat(121) }, adult).ok).toBe(false);
    expect(validateProfile({ ...complete, career: "__otra__", career_other: "" }, adult).ok).toBe(false);
    expect(validateProfile({ ...complete, career: "__otra__", career_other: "Ciencias de la Educación" }, adult)).toMatchObject({
      ok: true,
      value: { career: "Ciencias de la Educación" },
    });
  });

  it("universidad «Otra»: exige el texto escrito a mano y lo guarda", () => {
    const empty = validateProfile({ ...complete, university: "__otra__", university_other: "" }, adult);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(Object.keys(empty.fieldErrors)).toEqual(["university_other"]);
    expect(validateProfile({ ...complete, university: "__otra__", university_other: "Universidad de Prueba" }, adult)).toMatchObject({
      ok: true,
      value: { university: "Universidad de Prueba" },
    });
  });

  it("«¿Ya estás en una residencia?» pide el nombre; con «no» se descarta", () => {
    expect(validateProfile({ ...complete, in_residence: "si", current_residence: "" }, adult).ok).toBe(false);
    expect(validateProfile({ ...complete, in_residence: "no", current_residence: "Residencia X" }, adult)).toMatchObject({ ok: true, value: { currentResidence: null } });
  });

  it("un menor completa el perfil y la comunidad queda apagada, aunque mande el casillero", () => {
    const result = validateProfile({ ...complete, community: "on" }, { isMinor: true, now: NOW });
    expect(result).toMatchObject({ ok: true, value: { consentComunidad: false } });
  });
});

describe("profileProgress", () => {
  const none = { name: false, country: false, university: false, career: false, entry: false, roomType: false, habits: false, interests: false };
  it("arranca en 10 % y llega a 100 %", () => {
    expect(profileProgress(none)).toBe(10);
    expect(profileProgress({ ...none, name: true, country: true, university: true, career: true })).toBe(55);
    expect(profileProgress({ name: true, country: true, university: true, career: true, entry: true, roomType: true, habits: true, interests: true })).toBe(100);
  });
});
