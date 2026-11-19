/**
 * Textos de fotos (2026-11-19): la ficha no rota fotos y la sección que era «Fachada / Exterior» se muestra como «Foto principal o de
 * presentación». Son pruebas estructurales sobre el código fuente: el gestor y el visor se montan con el navegador y no corren en CI.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("textos de fotos", () => {
  it("el gestor y el modelo de fotos ya no dicen que las fotos «rotan»", () => {
    for (const rel of [
      "app/residence/[residence_id]/profile/PhotoMetaManager.tsx",
      "app/residence/[residence_id]/profile/photoMetaActions.ts",
      "lib/residences/photoMeta.ts",
    ]) {
      expect(read(rel), rel).not.toMatch(/\brotan\b|\brotar\b|rotaci[oó]n/i);
    }
  });

  it("el gestor no muestra «Fachada»: el título sale de la etiqueta nueva", () => {
    const manager = read("app/residence/[residence_id]/profile/PhotoMetaManager.tsx");
    expect(manager).toContain("Foto principal o de presentación");
    expect(manager).not.toMatch(/Entrada \/ fachada/);
  });

  it("el visor arma las secciones solo con las fotos (nunca recorre secciones fijas)", () => {
    const viewer = read("components/residences/PhotoViewer.tsx");
    expect(viewer).toContain("groupPhotosBySections(photos)");
    expect(viewer).not.toMatch(/PHOTO_AREAS|buildPhotoSections|SECTION_SUGGESTIONS/);
  });

  it("el botón de pausa del carrusel (sin usos) se borró", () => {
    expect(existsSync(join(root, "components/residences/RotationToggle.tsx"))).toBe(false);
  });
});
