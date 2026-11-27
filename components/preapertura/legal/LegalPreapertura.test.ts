import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreaperturaPrivacyBody, PreaperturaTermsBody } from "@/components/preapertura/legal/LegalPreapertura";
import { PREAPERTURA_LEGAL } from "@/lib/legal/versions";

const html = renderToStaticMarkup(createElement(PreaperturaTermsBody));
const privacy = renderToStaticMarkup(createElement(PreaperturaPrivacyBody));

describe("Privacidad de la preapertura: Meta (decisión del dueño 2026-11-27)", () => {
  it("nombra a Meta, qué recibe, que depende de aceptar las cookies y qué no se le manda", () => {
    expect(privacy).toContain("Meta (Facebook e Instagram):");
    expect(privacy).toContain("solo si aceptás sus cookies");
    expect(privacy).toContain("Recibe tu IP, datos de tu navegador, las páginas que visitás y si te registraste.");
    expect(privacy).toContain("Puede guardarlos fuera de Argentina.");
    expect(privacy).toContain("No le mandamos tu nombre ni tu email.");
  });

  it("la versión del texto es la del cambio", () => {
    expect(PREAPERTURA_LEGAL).toEqual({ version: "2026-11-27", updatedLabel: "27 de noviembre de 2026" });
    expect(privacy).toContain("27 de noviembre de 2026");
  });
});

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
