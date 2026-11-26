import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStudentAccount } from "@/lib/preapertura/accounts";
import { loadCommunityCards } from "@/lib/preapertura/communityRailData";
import { RAIL_CARD_KEYS, RAIL_COLUMNS, buildRail, firstNameOnly, railTitle, toRailCard } from "@/lib/preapertura/communityRail";
import { EXAMPLE_PROFILES, EXAMPLES_OFF_AT, examplesToShow } from "@/lib/preapertura/rules";
import { CAREER_OPTIONS, HABIT_OPTIONS, INTEREST_OPTIONS } from "@/lib/preapertura/options";
import { maskEmail, profilePercentOf } from "@/lib/preapertura/miLugar";

/** Columnas que JAMÁS pueden salir en el carrusel público (DR44.1): apellido, residencia actual, contacto, ids y lo que identifica. */
const FORBIDDEN = ["last_name", "current_residence", "email", "phone", "user_id", "id", "invited_by_user_id", "university", "province", "role", "terms_accepted_at"];

const NOW = new Date("2026-11-08T15:00:00Z");
const adultRow = {
  first_name: "Lucía Pérez",
  birth_date: "2005-03-10",
  country: "Uruguay",
  career: "Medicina",
  habits: ["Madrugo", "No fumo"],
  interests: ["Lectura", "Cine"],
  // Todo esto NO puede salir:
  last_name: "Pérez",
  current_residence: "Residencia Secreta",
  email: "lucia@example.com",
  university: "UBA",
  province: "Salta",
  user_id: "00000000-0000-0000-0000-000000000001",
};

describe("carrusel público: privacidad (DR44)", () => {
  it("la consulta pide SOLO columnas permitidas y ninguna prohibida", () => {
    expect([...RAIL_COLUMNS].sort()).toEqual(["birth_date", "career", "country", "created_at", "first_name", "habits", "interests"]);
    for (const col of FORBIDDEN) expect(RAIL_COLUMNS as readonly string[]).not.toContain(col);
  });
  it("la tarjeta tiene exactamente las claves públicas: nunca apellido, residencia actual, universidad, provincia, email ni fecha de nacimiento", () => {
    const card = toRailCard(adultRow, 0, NOW);
    expect(card).not.toBeNull();
    expect(Object.keys(card!).sort()).toEqual([...RAIL_CARD_KEYS].sort());
    const serialized = JSON.stringify(card);
    for (const secret of ["Pérez", "Residencia Secreta", "lucia@example.com", "UBA", "Salta", "2005-03-10", "00000000-0000"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(card).toMatchObject({ kind: "real", name: "Lucía", age: 21, country: "Uruguay", career: "Medicina" });
    expect(card!.flag).toBe("🇺🇾");
  });
  it("solo el primer nombre, aunque en el campo escriban el apellido", () => {
    expect(firstNameOnly("  Lucía   María Pérez ")).toBe("Lucía");
    expect(firstNameOnly(null)).toBe("");
  });
  it("no muestra menores, sin edad válida ni sin nombre", () => {
    expect(toRailCard({ ...adultRow, birth_date: "2010-01-01" }, 0, NOW)).toBeNull();
    expect(toRailCard({ ...adultRow, birth_date: null }, 0, NOW)).toBeNull();
    expect(toRailCard({ ...adultRow, first_name: "  " }, 0, NOW)).toBeNull();
    expect(toRailCard({ ...adultRow, first_name: null }, 0, NOW)).toBeNull();
  });
  it("la carrera libre («Otra carrera…») nunca se muestra: sale «Otra»; solo valores de las listas cerradas", () => {
    expect(toRailCard({ ...adultRow, career: "Ingeniería Aeroespacial Secreta" }, 0, NOW)!.career).toBe("Otra");
    expect(toRailCard({ ...adultRow, career: "Derecho" }, 0, NOW)!.career).toBe("Derecho");
    expect(toRailCard({ ...adultRow, career: "  " }, 0, NOW)!.career).toBeNull();
    const card = toRailCard({ ...adultRow, country: "Narnia", habits: ["Madrugo", "texto libre"], interests: ["<b>x</b>", "Cine"] }, 0, NOW)!;
    expect(card.country).toBeNull();
    expect(card.flag).toBe("");
    expect(card.tags).toEqual(["Madrugo", "Cine"]);
    expect(JSON.stringify(card)).not.toMatch(/Aeroespacial|Narnia|texto libre|<b>/);
    expect(toRailCard({ ...adultRow, country: "Otro país" }, 0, NOW)!.country).toBeNull();
  });
  it("hasta 2 pastillas, un hábito y un interés (DR67)", () => {
    expect(toRailCard(adultRow, 0, NOW)!.tags).toEqual(["Madrugo", "Lectura"]);
  });
});

describe("carrusel público: retiro de ejemplos", () => {
  const real = (n: number) => Array.from({ length: n }, (_, i) => toRailCard({ ...adultRow, first_name: `Real${i}` }, i, NOW)!);
  it("10 perfiles ficticios con valores de las listas cerradas; se apagan con 10 reales (DR67)", () => {
    expect(EXAMPLE_PROFILES).toHaveLength(10);
    expect(EXAMPLES_OFF_AT).toBe(10);
    expect(examplesToShow(4)).toBe(6);
    expect(examplesToShow(10)).toBe(0);
    expect(new Set(EXAMPLE_PROFILES.map((e) => e.name)).size).toBe(10);
    const tags: readonly string[] = [...HABIT_OPTIONS, ...INTEREST_OPTIONS];
    for (const example of EXAMPLE_PROFILES) {
      expect(CAREER_OPTIONS as readonly string[], example.name).toContain(example.career);
      for (const tag of example.tags) expect(tags, example.name).toContain(tag);
      expect(example.age).toBeGreaterThanOrEqual(18);
    }
  });
  it("con algún ficticio el título es de vista previa; «Se están sumando» solo con todo real", () => {
    expect(railTitle(true)).toBe("Así vas a ver a tus posibles compañeros");
    expect(railTitle(false)).toBe("Se están sumando");
  });
  it("sin reales, solo ejemplos; cada real retira uno", () => {
    const none = buildRail([]);
    expect(none.cards.every((c) => c.kind === "example")).toBe(true);
    expect(none.cards).toHaveLength(EXAMPLE_PROFILES.length);
    expect(none.hasExamples).toBe(true);
    const two = buildRail(real(2));
    expect(two.cards.filter((c) => c.kind === "real")).toHaveLength(2);
    expect(two.cards.filter((c) => c.kind === "example")).toHaveLength(EXAMPLE_PROFILES.length - 2);
  });
  it("al llegar a 10 reales no queda ningún ejemplo", () => {
    const full = buildRail(real(EXAMPLES_OFF_AT));
    expect(full.hasExamples).toBe(false);
    expect(full.cards.every((c) => c.kind === "real")).toBe(true);
  });
});

describe("Mi lugar: utilidades", () => {
  it("enmascara el mail del estudiante invitado", () => {
    expect(maskEmail("lucia@gmail.com")).toBe("lu•••@gmail.com");
    expect(maskEmail("a@x.com")).toBe("a•••@x.com");
    expect(maskEmail("sin-arroba")).toBe("•••");
  });
  it("el % de perfil arranca en 10 y llega a 100 con todo", () => {
    const empty = { first_name: null, country: null, university: null, career: null, entry_month: null, entry_unsure: false, room_type: null, habits: [], interests: [] };
    expect(profilePercentOf(empty)).toBe(10);
    expect(profilePercentOf({ first_name: "Lu", country: "Chile", university: "UBA", career: "Derecho", entry_month: 3, entry_unsure: false, room_type: "any", habits: ["a", "b"], interests: ["c", "d"] })).toBe(100);
  });
});

/** Integración contra `estured-dev` (requiere 0080): crea cuentas de prueba y las borra al final. */
const admin: SupabaseClient | null = getSupabaseAdmin();
let ready = false;
const created: string[] = [];
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PASSWORD = `Tmp-${Math.random().toString(36).slice(2)}-Aa1!`;

async function makeStudent(tag: string, birthDate: string, age: number, profile: Record<string, unknown>) {
  if (!admin) throw new Error("sin admin");
  const result = await createStudentAccount(admin, { email: `test-rail-${tag}-${stamp}@estured.test`, password: PASSWORD, birthDate, age, isMinor: age < 18, invitation: null, ip: null, userAgent: "vitest" });
  if (!result.ok) throw new Error(`no se pudo crear ${tag}: ${result.reason}`);
  created.push(result.userId);
  await admin.from("preapertura_estudiantes").update(profile).eq("user_id", result.userId);
  return result.userId;
}

beforeAll(async () => {
  if (!admin) return;
  const probe = await admin.from("preapertura_estudiantes").select("id").limit(1);
  ready = !probe.error;
  if (!ready) console.warn("[preapertura] communityRail.test: migración 0080 sin aplicar; la integración se saltea.");
});
afterAll(async () => {
  if (!admin) return;
  for (const id of [...created].reverse()) await admin.auth.admin.deleteUser(id).catch(() => {});
});

describe("carrusel público contra la base (requiere 0080)", () => {
  it("muestra solo a quien tildó la comunidad, adulto y con nombre; nada más sale al navegador", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const base = { country: "Chile", career: "Derecho", habits: ["Madrugo"], interests: ["Cine"], current_residence: "Residencia Secreta", university: "UBA", province: "Salta" };
    await makeStudent("si", "2004-05-05", 22, { ...base, first_name: "Rail Visible Apellido", consent_comunidad: true });
    await makeStudent("no", "2004-05-05", 22, { ...base, first_name: "Rail Oculta", consent_comunidad: false });
    await makeStudent("menor", "2012-05-05", 14, { ...base, first_name: "Rail Menor", consent_comunidad: true });

    const cards = await loadCommunityCards(admin);
    const mine = cards.filter((c) => c.name.startsWith("Rail"));
    expect(mine.map((c) => c.name)).toEqual(["Rail"]); // solo la adulta con casillero tildado, y solo su primer nombre
    const serialized = JSON.stringify(cards);
    for (const secret of ["Apellido", "Residencia Secreta", "UBA", "Salta", "estured.test", "2004-05-05"]) expect(serialized).not.toContain(secret);
    for (const card of cards) expect(Object.keys(card).sort()).toEqual([...RAIL_CARD_KEYS].sort());
  });

  it("si destilda el casillero, desaparece de la consulta", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const id = await makeStudent("baja", "2003-01-01", 23, { first_name: "RailBaja", consent_comunidad: true });
    expect((await loadCommunityCards(admin)).some((c) => c.name === "RailBaja")).toBe(true);
    await admin.from("preapertura_estudiantes").update({ consent_comunidad: false }).eq("user_id", id);
    expect((await loadCommunityCards(admin)).some((c) => c.name === "RailBaja")).toBe(false);
  });
});

/** Fecha de nacimiento (YYYY-MM-DD) de alguien que cumple 18 dentro de `daysFromNow` días (negativo = los cumplió hace tantos). */
function birthTurning18In(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  d.setUTCFullYear(d.getUTCFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

describe("carrusel público: el filtro de edad sale de la fecha de nacimiento (requiere 0080)", () => {
  it("quien cumple 18 dentro de unos días NO aparece (aunque haya tildado y no sea 'menor' en el registro); quien ya los cumplió, sí", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const base = { country: "Chile", career: "Derecho", habits: ["Madrugo"], interests: ["Cine"], consent_comunidad: true };
    // Se crean como adultos (la edad del alta no importa para el carrusel): lo que decide es `birth_date` guardada.
    await makeStudent("casi", birthTurning18In(3), 18, { ...base, first_name: "RailCasi18" });
    await makeStudent("ya", birthTurning18In(-3), 18, { ...base, first_name: "RailYa18" });
    const names = (await loadCommunityCards(admin)).map((c) => c.name);
    expect(names).not.toContain("RailCasi18");
    expect(names).toContain("RailYa18");
  });
});
