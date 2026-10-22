import { describe, expect, it } from "vitest";
import {
  buildApplicantProfile,
  readProfileItems,
  type ApplicantProfileSource,
} from "@/lib/applications/applicantProfile";

const NOW = new Date("2026-10-22T15:00:00Z");

function source(overrides: Partial<ApplicantProfileSource> = {}): ApplicantProfileSource {
  return {
    first_name: "Camila",
    last_initial: "R",
    birth_date: "2002-05-10", // 24 años
    display_age: 24,
    is_minor: false,
    nationality: "Argentina",
    origin_city: "Rosario",
    origin_country: "Argentina",
    career: "Medicina",
    study_institution_private: "UBA",
    bio: "Me gusta estudiar en silencio.",
    habits: { items: ["Ordenado", "Madrugador"] },
    interests: { items: ["Cine", "Lectura"] },
    student_visibility_settings: {
      is_individual_profile_visible: true,
      show_habits_to_registered: true,
      show_interests_to_registered: true,
    },
    ...overrides,
  };
}

describe("buildApplicantProfile - adulto", () => {
  it("muestra el perfil completo cuando compartió todo", () => {
    const v = buildApplicantProfile(source(), { contactTarget: "student", now: NOW });
    expect(v).toMatchObject({
      displayName: "Camila R.",
      avatarInitial: "C",
      isMinor: false,
      managedByFamily: false,
      age: 24,
      career: "Medicina",
      university: "UBA",
      origin: "Rosario, Argentina",
      bio: "Me gusta estudiar en silencio.",
      habits: ["Ordenado", "Madrugador"],
      interests: ["Cine", "Lectura"],
      notShared: [],
    });
  });

  it("respeta cada interruptor por separado", () => {
    const v = buildApplicantProfile(
      source({
        student_visibility_settings: {
          is_individual_profile_visible: true,
          show_habits_to_registered: false,
          show_interests_to_registered: true,
        },
      }),
      { contactTarget: "student", now: NOW },
    );
    expect(v.habits).toEqual([]);
    expect(v.interests).toEqual(["Cine", "Lectura"]);
    expect(v.bio).not.toBeNull();
    expect(v.notShared).toEqual(["habits"]);
  });

  it("con el interruptor maestro apagado no comparte presentación, hábitos ni intereses, aunque los demás estén prendidos", () => {
    const v = buildApplicantProfile(
      source({
        student_visibility_settings: {
          is_individual_profile_visible: false,
          show_habits_to_registered: true,
          show_interests_to_registered: true,
        },
      }),
      { contactTarget: "student", now: NOW },
    );
    expect(v.bio).toBeNull();
    expect(v.habits).toEqual([]);
    expect(v.interests).toEqual([]);
    expect(v.notShared).toEqual(["bio", "habits", "interests"]);
    // Los datos básicos de la solicitud siguen visibles.
    expect(v.age).toBe(24);
    expect(v.career).toBe("Medicina");
  });

  it("sin fila de visibilidad no comparte nada opcional", () => {
    const v = buildApplicantProfile(source({ student_visibility_settings: null }), { contactTarget: "student", now: NOW });
    expect(v.bio).toBeNull();
    expect(v.habits).toEqual([]);
    expect(v.interests).toEqual([]);
    expect(v.notShared).toHaveLength(3);
  });

  it("no marca como 'no compartido' lo que sí compartió pero está vacío", () => {
    const v = buildApplicantProfile(source({ habits: { items: [] }, bio: "  " }), { contactTarget: "student", now: NOW });
    expect(v.habits).toEqual([]);
    expect(v.bio).toBeNull();
    expect(v.notShared).toEqual([]);
  });

  it("calcula la edad desde la fecha de nacimiento", () => {
    expect(buildApplicantProfile(source({ birth_date: "2002-12-01", display_age: 99 }), { contactTarget: "student", now: NOW }).age).toBe(23);
  });

  it("sin fecha de nacimiento válida: solo lo básico, SIN afirmar que es menor", () => {
    const v = buildApplicantProfile(source({ birth_date: "no-es-fecha", display_age: 30 }), { contactTarget: "student", now: NOW });
    expect(v.isMinor).toBe(false);
    expect(v.birthDateMissing).toBe(true);
    expect(v.age).toBe(30);
    expect(v.career).toBe("Medicina");
    expect(v.university).toBeNull();
    expect(v.origin).toBeNull();
    expect(v.bio).toBeNull();
    expect(v.habits).toEqual([]);
    expect(v.interests).toEqual([]);
    expect(v.notShared).toEqual([]);
    expect(v.managedByFamily).toBe(false);
  });

  it("sin fecha pero con is_minor=true sí es menor confirmado", () => {
    const v = buildApplicantProfile(source({ birth_date: null, is_minor: true }), { contactTarget: "student", now: NOW });
    expect(v.isMinor).toBe(true);
    expect(v.birthDateMissing).toBe(false);
  });

  it("oculta teléfonos, emails y redes en la presentación, hábitos e intereses", () => {
    const v = buildApplicantProfile(
      source({
        bio: "Escribime al +54 9 11 2345-6789 o a cami@gmail.com. Mi insta es cami_rojas.",
        habits: { items: ["Ordenado", "wsp: 1123456789"] },
        interests: { items: ["Cine", "@cami_rojas"] },
      }),
      { contactTarget: "student", now: NOW },
    );
    const json = JSON.stringify(v);
    expect(json).not.toContain("2345");
    expect(json).not.toContain("gmail");
    expect(json).not.toContain("cami_rojas");
    expect(json).not.toContain("1123456789");
    expect(v.bio).toContain("[dato de contacto oculto]");
    expect(v.habits).toContain("Ordenado");
    expect(v.interests).toContain("Cine");
  });

  it("marca que la gestiona el familiar cuando el contacto va al familiar", () => {
    const v = buildApplicantProfile(source(), { contactTarget: "family_member", now: NOW });
    expect(v.managedByFamily).toBe(true);
    expect(v.isMinor).toBe(false);
    expect(v.bio).not.toBeNull();
  });

  it("origen: usa la nacionalidad si no hay país, y queda null si no hay nada", () => {
    expect(buildApplicantProfile(source({ origin_country: null, origin_city: "Lima", nationality: "Peruana" }), { contactTarget: "student", now: NOW }).origin).toBe("Lima, Peruana");
    expect(buildApplicantProfile(source({ origin_country: null, origin_city: null, nationality: null }), { contactTarget: "student", now: NOW }).origin).toBeNull();
  });
});

describe("buildApplicantProfile - menor", () => {
  const minorSource = (extra: Partial<ApplicantProfileSource> = {}) =>
    source({ birth_date: "2010-03-04", display_age: 16, is_minor: true, ...extra });

  it("solo nombre e inicial, edad y carrera: sin universidad, origen, presentación, hábitos ni intereses", () => {
    const v = buildApplicantProfile(minorSource(), { contactTarget: "family_member", now: NOW });
    expect(v).toMatchObject({
      displayName: "Camila R.",
      isMinor: true,
      managedByFamily: true,
      age: 16,
      career: "Medicina",
      university: null,
      origin: null,
      bio: null,
      habits: [],
      interests: [],
      notShared: [],
    });
  });

  it("aunque los interruptores figuren prendidos (datos viejos), no se filtra nada", () => {
    const v = buildApplicantProfile(minorSource(), { contactTarget: "student", now: NOW });
    expect(JSON.stringify(v)).not.toContain("Cine");
    expect(JSON.stringify(v)).not.toContain("silencio");
    expect(JSON.stringify(v)).not.toContain("UBA");
    expect(JSON.stringify(v)).not.toContain("Rosario");
    // Para un menor la gestiona siempre el familiar, aunque el contacto figure al estudiante.
    expect(v.managedByFamily).toBe(true);
  });

  it("un perfil con is_minor=true se trata como menor aunque la fecha diga que es adulto", () => {
    const v = buildApplicantProfile(source({ is_minor: true }), { contactTarget: "student", now: NOW });
    expect(v.isMinor).toBe(true);
    expect(v.bio).toBeNull();
  });

  it("cumple 18 hoy en Buenos Aires: ya es adulto", () => {
    const v = buildApplicantProfile(source({ birth_date: "2008-10-22", is_minor: false }), { contactTarget: "student", now: NOW });
    expect(v.isMinor).toBe(false);
    expect(v.age).toBe(18);
  });
});

describe("buildApplicantProfile - sin perfil y contrato", () => {
  it("sin perfil devuelve un placeholder sin datos", () => {
    const v = buildApplicantProfile(null, { contactTarget: "student", now: NOW });
    expect(v.displayName).toBe("Estudiante");
    expect(v.bio).toBeNull();
    expect(v.habits).toEqual([]);
  });

  it("el resultado no contiene apellido, fecha de nacimiento ni contacto", () => {
    const v = buildApplicantProfile(
      source({ ...({ last_name: "Rojas", email: "camila@example.com", phone: "+54911" } as object) }),
      { contactTarget: "student", now: NOW },
    );
    const json = JSON.stringify(v);
    expect(json).not.toContain("Rojas");
    expect(json).not.toContain("example.com");
    expect(json).not.toContain("+54911");
    expect(json).not.toContain("2002-05-10");
  });
});

describe("readProfileItems", () => {
  it("acepta { items } o un array, descarta lo que no es texto y limita largo y cantidad", () => {
    expect(readProfileItems({ items: ["Cine", 3, "  ", null, "Música "] })).toEqual(["Cine", "Música"]);
    expect(readProfileItems(["Cine"])).toEqual(["Cine"]);
    expect(readProfileItems(null)).toEqual([]);
    expect(readProfileItems({ items: "Cine" })).toEqual([]);
    expect(readProfileItems({ items: ["x".repeat(200)] })[0]).toHaveLength(60);
    expect(readProfileItems({ items: Array.from({ length: 50 }, (_, i) => `h${i}`) })).toHaveLength(30);
  });
});
