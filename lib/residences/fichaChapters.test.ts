import { describe, expect, it } from "vitest";
import { buildChapters, CHAPTER_DEFS } from "@/lib/residences/fichaChapters";

const all = { vivir: true, tarifas: true, incluye: true, preguntas: true, comunidad: true, reglas: true, ubicacion: true };

describe("buildChapters", () => {
  it("con todo visible, siete capítulos en el orden oficial y numerados 01 a 07", () => {
    const chapters = buildChapters(all);
    expect(chapters.map((c) => c.key)).toEqual(["vivir", "tarifas", "incluye", "preguntas", "comunidad", "reglas", "ubicacion"]);
    expect(chapters.map((c) => c.number)).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
  });

  it("las preguntas siguen siendo el capítulo 04 (decisión del dueño) cuando todo lo anterior se muestra", () => {
    expect(buildChapters(all).find((c) => c.key === "preguntas")?.number).toBe("04");
  });

  it("un capítulo sin contenido se omite y la numeración no deja huecos", () => {
    const chapters = buildChapters({ ...all, vivir: false, comunidad: false });
    expect(chapters.map((c) => [c.key, c.number])).toEqual([
      ["tarifas", "01"],
      ["incluye", "02"],
      ["preguntas", "03"],
      ["reglas", "04"],
      ["ubicacion", "05"],
    ]);
  });

  it("lo que no se declara no se muestra", () => {
    expect(buildChapters({ tarifas: true }).map((c) => c.key)).toEqual(["tarifas"]);
    expect(buildChapters({})).toEqual([]);
  });

  it("los ids son únicos y «tarifas» conserva el ancla histórica #tarifas", () => {
    const ids = CHAPTER_DEFS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CHAPTER_DEFS.find((c) => c.key === "tarifas")?.id).toBe("tarifas");
  });
});
