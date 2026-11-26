import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// El carrusel sale de la base: acá solo importa la pantalla, con la tira de perfiles ficticios.
vi.mock("@/lib/preapertura/communityRailData", async () => {
  const { buildRail } = await import("@/lib/preapertura/communityRail");
  return { getCommunityRail: async () => buildRail([]) };
});

import { EntryContent } from "@/components/preapertura/EntryContent";
import type { StudentCounter } from "@/lib/preapertura/rules";

async function render(counter: StudentCounter = { kind: "first" }): Promise<string> {
  return renderToStaticMarkup(await EntryContent({ counter, founders: { kind: "none" }, closure: { kind: "none" } }));
}

describe("popup de entrada de la preapertura (DR67)", () => {
  it("muestra el copy aprobado", async () => {
    const html = await render();
    for (const t of [
      "Acceso anticipado abierto",
      "Muy pronto:",
      "Reservá tu residencia en Buenos Aires,",
      "con la seguridad de elegir bien.",
      "enterate primero",
      "Residencias verificadas en persona",
      "Reglas y costos claros",
      "Conocé la comunidad antes de elegir",
      "Quiero enterarme primero",
      "Gratis. Sin tarjeta.",
      "Así vas a ver a tus posibles compañeros",
      "Términos",
    ]) {
      expect(html).toContain(t);
    }
  });

  it("no muestra el ingreso, el acceso familiar ni el copy anterior", async () => {
    const html = await render();
    for (const t of ["Ingresá", "Soy familiar", "Sumarte es gratis", "Sumarme gratis", "Sé de los primeros", "Se están sumando", "Encontrá"]) {
      expect(html).not.toContain(t);
    }
  });

  it("la tarjeta de fundadoras va antes del carrusel", async () => {
    const html = await render();
    const founders = html.indexOf('href="/fundadoras"');
    expect(founders).toBeGreaterThan(-1);
    expect(founders).toBeLessThan(html.indexOf("Así vas a ver"));
  });

  it("el contador aparece solo con un número real", async () => {
    expect(await render()).not.toContain("estudiantes ya se sumaron");
    expect(await render({ kind: "number", count: 26 })).toContain("estudiantes ya se sumaron");
  });
});
