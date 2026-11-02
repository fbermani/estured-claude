import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { countWords, parseGuide, readingMinutes, slugifyHeading, splitFrontmatter } from "./parse";
import { readGuidesFromDir } from "./load";
import { isValidGuideCtaHref } from "./routes";

const SAMPLE = `---
title: Una guía
slug: una-guia
description: 'Con ''comillas'' y
  continuación.'
category: alojamiento
audience:
- estudiantes
- familias
status: borrador-editorial
order: 3
featured: true
related_guides:
- 02-otra
cta:
  label: Buscar
  href: /search
---

# Una guía

ESTUDIANTES Y FAMILIAS

Bajada de la guía.

## Primera sección

Texto con **negrita** y [enlace](https://x.test).

- uno
- dos

## Checklist final

¿Primera? ¿Segunda? Cierre.

## Fuentes para consultar antes de publicar

Migraciones (argentina.gob.ar/interior/migraciones); SUBE (argentina.gob.ar/sube). Confirmar enlaces y trámites vigentes antes de lanzar.

<!-- NOTA INTERNA -->
`;

describe("parseGuide", () => {
  const g = parseGuide("01-una-guia", SAMPLE);
  it("lee frontmatter (strings, listas, cta, comillas plegadas)", () => {
    expect(g.slug).toBe("una-guia");
    expect(g.description).toBe("Con 'comillas' y continuación.");
    expect(g.audience).toEqual(["estudiantes", "familias"]);
    expect(g.featured).toBe(true);
    expect(g.order).toBe(3);
    expect(g.relatedGuideIds).toEqual(["02-otra"]);
    expect(g.cta).toEqual({ label: "Buscar", href: "/search" });
  });
  it("separa eyebrow, bajada y secciones, y descarta comentarios", () => {
    expect(g.eyebrow).toBe("ESTUDIANTES Y FAMILIAS");
    expect(g.lede).toBe("Bajada de la guía.");
    expect(g.sections.map((s) => s.heading)).toEqual(["Primera sección", "Checklist final", "Fuentes oficiales para consultar"]);
    expect(JSON.stringify(g)).not.toContain("NOTA INTERNA");
  });
  it("detecta listas y checklist conservando el texto de las preguntas", () => {
    expect(g.sections[0].blocks[1]).toEqual({ type: "list", ordered: false, items: ["uno", "dos"] });
    expect(g.sections[1].variant).toBe("checklist");
    expect(g.sections[1].blocks).toEqual([
      { type: "checklist", items: ["¿Primera?", "¿Segunda?"] },
      { type: "paragraph", text: "Cierre." },
    ]);
  });
  it("convierte organismos en enlaces y reescribe la sección de fuentes", () => {
    const text = JSON.stringify(g.sections[2]);
    expect(text).toContain("[Migraciones](https://argentina.gob.ar/interior/migraciones)");
    expect(text).toContain("[SUBE](https://argentina.gob.ar/sube)");
    expect(text).toContain("confirmalos en cada sitio oficial");
  });
  it("calcula tiempo de lectura por palabras (mínimo 1 min)", () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(401)).toBe(3);
    expect(countWords("**a** [b c](x)")).toBe(3);
    expect(g.readMinutes).toBeGreaterThanOrEqual(1);
  });
  it("falla con campos obligatorios inválidos", () => {
    expect(() => parseGuide("x", "---\ntitle: a\n---\n")).toThrow();
    expect(() => parseGuide("x", SAMPLE.replace("category: alojamiento", "category: nada"))).toThrow();
  });
});

describe("utilidades", () => {
  it("slugifyHeading quita tildes y signos", () => {
    expect(slugifyHeading("¿Qué mirar además de las fotos?")).toBe("que-mirar-ademas-de-las-fotos");
  });
  it("splitFrontmatter sin frontmatter devuelve todo como cuerpo", () => {
    expect(splitFrontmatter("hola").body).toBe("hola");
  });
  it("CTA solo a rutas existentes", () => {
    const slugs = new Set(["a-b"]);
    expect(isValidGuideCtaHref("/search", slugs)).toBe(true);
    expect(isValidGuideCtaHref("/guias/a-b", slugs)).toBe(true);
    expect(isValidGuideCtaHref("/guias/nope", slugs)).toBe(false);
    expect(isValidGuideCtaHref("/inventada", slugs)).toBe(false);
  });
});

describe("content/guias (loader)", () => {
  const dir = path.join(process.cwd(), "content", "guias");
  const guides = readGuidesFromDir(dir);
  it("carga las guías con slugs únicos y relacionadas resueltas", () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    expect(guides).toHaveLength(files.length);
    expect(new Set(guides.map((g) => g.slug)).size).toBe(guides.length);
    for (const g of guides) {
      expect(g.sections.length).toBeGreaterThan(2);
      for (const id of g.relatedGuideIds) expect(guides.some((x) => x.id === id)).toBe(true);
    }
  });
  it("ninguna guía publica «mediación» ni «Residencia Sin Fronteras»", () => {
    const all = JSON.stringify(guides);
    expect(all).not.toMatch(/mediaci[oó]n/i);
    expect(all).not.toMatch(/Sin Fronteras/i);
  });
});
