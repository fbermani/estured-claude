import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/" }));
vi.mock("@/app/residence/[residence_id]/faq/actions", () => ({ saveFaqBatchAction: async () => ({ status: "ok", catalog: {} }) }));

import { FaqEditorProvider, type FaqCatalogInfo } from "@/app/residence/[residence_id]/faq/FaqEditor";
import { FaqCatalogEditor } from "@/app/residence/[residence_id]/faq/FaqCatalogEditor";
import { OwnFaqSection } from "@/app/residence/[residence_id]/faq/OwnFaqSection";
import { FaqSaveAll } from "@/app/residence/[residence_id]/faq/FaqSaveAll";

const item = (id: string, category: string, question: string, extra: Partial<FaqCatalogInfo> = {}): FaqCatalogInfo => ({
  id,
  category,
  question,
  owner: "residence",
  suggestedAnswer: "Sugerida {dato}.",
  essential: false,
  initialSelected: false,
  initialAnswer: "Sugerida {dato}.",
  ...extra,
});

function render(items: FaqCatalogInfo[], ownItems = [{ question: "¿Parlantes?", answer: "Hasta las 23." }]) {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- el tipo exige `children` en las props y el archivo es .ts (sin JSX)
    createElement(FaqEditorProvider, {
      residenceId: "res-1",
      items,
      initialOwn: ownItems,
      canEditCatalog: true,
      canEditOwn: true,
      children: createElement(Fragment, null, createElement(FaqCatalogEditor), createElement(OwnFaqSection), createElement(FaqSaveAll)),
    }),
  );
}

describe("pantalla de preguntas (render del servidor)", () => {
  const items = [
    item("FAQ-07", "que_llevar", "¿Qué tengo que llevar?", { essential: true, initialSelected: true, initialAnswer: "Sábanas." }),
    item("FAQ-04", "que_llevar", "¿Hay lavadero?"),
    item("FAQ-02", "requisitos", "¿Qué documentos piden?"),
  ];

  it("todos los temas arrancan cerrados, aunque tengan preguntas elegidas", () => {
    const html = render(items);
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("las preguntas de los temas cerrados siguen montadas (se ven en el HTML)", () => {
    const html = render(items);
    for (const text of ["¿Qué tengo que llevar?", "¿Hay lavadero?", "¿Qué documentos piden?"]) expect(html).toContain(text);
  });

  it("no muestra el código de la pregunta (solo aparece en los ids internos del HTML)", () => {
    const text = render(items).replace(/<[^>]*>/g, " ");
    expect(text).not.toMatch(/FAQ-\d+/);
  });

  it("incluye las preguntas propias, el botón global y no marca cambios sin guardar de entrada", () => {
    const html = render(items);
    expect(html).toContain("Preguntas propias de tu residencia");
    expect(html).toContain("¿Parlantes?");
    expect(html).toContain("Guardar todo y volver");
    expect(html).toContain("No tenés cambios sin guardar.");
    expect(html).not.toContain("Sin guardar</span>");
  });

  it("sin preguntas propias muestra el estado vacío y permite agregar", () => {
    const html = render(items, []);
    expect(html).toContain("Todavía no escribiste preguntas propias");
    expect(html).toContain("Agregar una pregunta propia");
  });
});
