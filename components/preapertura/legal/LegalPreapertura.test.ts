import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreaperturaTermsBody } from "@/components/preapertura/legal/LegalPreapertura";

const html = renderToStaticMarkup(createElement(PreaperturaTermsBody));

describe("Términos de la preapertura: describen la pantalla actual (DR67)", () => {
  it("avisa de los perfiles ilustrativos por el título de la sección, no por un rótulo que ya no existe", () => {
    expect(html).not.toContain("«Ejemplo»");
    expect(html).toContain("Así vas a ver a tus posibles compañeros");
    expect(html).toContain("no son personas reales");
  });

  it("habla del número de registro, que no da prioridad", () => {
    expect(html).not.toContain("Tu lugar en la lista");
    expect(html).toContain("Tu número de registro no da prioridad");
  });

  it("el retiro de la comunidad no depende de un enlace que solo aparece con el perfil completo", () => {
    expect(html).not.toContain("Editar mi perfil");
    expect(html).toContain("desde tu perfil");
  });
});
