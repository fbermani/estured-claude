import { describe, expect, it } from "vitest";
import { UNIVERSITY_OTHER_NAME } from "@/lib/data/buenosAiresUniversities";
import { universityCategory } from "@/lib/maps/universityPins";
import { UNIVERSITY_OPTIONS } from "@/lib/residences/options";
import { countSelected, groupUniversityOptions, initiallyOpenGroups, matchesUniversityQuery } from "@/lib/residences/universityGroups";

describe("groupUniversityOptions", () => {
  const { groups, other } = groupUniversityOptions(UNIVERSITY_OPTIONS);

  it("divide en UBA, otras públicas y privadas, en ese orden, con las mismas etiquetas del mapa", () => {
    expect(groups.map((g) => g.key)).toEqual(["uba", "public", "private"]);
    expect(groups.map((g) => g.label)).toEqual(["UBA", "Otras públicas", "Privadas"]);
  });
  it("usa la clasificación del mapa: cada nombre cae en el grupo que dice `universityCategory`", () => {
    for (const g of groups) for (const n of g.names) expect(universityCategory(n)).toBe(g.key);
  });
  it("no pierde ni repite ninguna opción; «Otra» queda aparte", () => {
    const all = groups.flatMap((g) => g.names);
    expect(other).toBe(UNIVERSITY_OTHER_NAME);
    expect(all).not.toContain(UNIVERSITY_OTHER_NAME);
    expect([...all, other].sort()).toEqual([...UNIVERSITY_OPTIONS].sort());
    expect(new Set(all).size).toBe(all.length);
  });
  it("cada grupo tiene opciones y las ordena alfabéticamente", () => {
    for (const g of groups) {
      expect(g.names.length).toBeGreaterThan(0);
      expect(g.names).toEqual([...g.names].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })));
    }
  });
  it("sin la opción «Otra» devuelve other = null", () => {
    expect(groupUniversityOptions(["UBA - Facultad de Derecho"]).other).toBeNull();
  });
  it("lo desconocido cuenta como privada (igual que el mapa)", () => {
    const r = groupUniversityOptions(["Instituto Nuevo"]);
    expect(r.groups.find((g) => g.key === "private")?.names).toEqual(["Instituto Nuevo"]);
  });
});

describe("countSelected / initiallyOpenGroups", () => {
  const { groups } = groupUniversityOptions(UNIVERSITY_OPTIONS);
  it("cuenta las elegidas por grupo", () => {
    const uba = groups[0].names;
    expect(countSelected(uba, new Set([uba[0], uba[1], "otra cosa"]))).toBe(2);
    expect(countSelected(uba, new Set())).toBe(0);
  });
  it("abre solo las secciones que ya tienen algo elegido", () => {
    expect([...initiallyOpenGroups(groups, new Set())]).toEqual([]);
    const open = initiallyOpenGroups(groups, new Set([groups[1].names[0], groups[2].names[0]]));
    expect([...open].sort()).toEqual(["private", "public"]);
  });
});

describe("matchesUniversityQuery", () => {
  it("vacío coincide con todo; ignora mayúsculas y tildes; cada palabra tiene que estar", () => {
    expect(matchesUniversityQuery("UBA - Facultad de Ingeniería", "")).toBe(true);
    expect(matchesUniversityQuery("UBA - Facultad de Ingeniería", "ingenieria")).toBe(true);
    expect(matchesUniversityQuery("UBA - Facultad de Ingeniería", "uba ingen")).toBe(true);
    expect(matchesUniversityQuery("UBA - Facultad de Ingeniería", "uba derecho")).toBe(false);
  });
});
