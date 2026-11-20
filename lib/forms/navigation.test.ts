import { describe, expect, it } from "vitest";
import { leavingNavigationTarget } from "@/lib/forms/navigation";

const HERE = "https://estured.vercel.app/residence/r1/profile";

describe("leavingNavigationTarget", () => {
  it("una ruta interna distinta saca de la pantalla", () => {
    expect(leavingNavigationTarget("/residence/r1/regulation", HERE)).toBe("/residence/r1/regulation");
    expect(leavingNavigationTarget("https://estured.vercel.app/residence/r1/faq?x=1#a", HERE)).toBe("/residence/r1/faq?x=1#a");
  });
  it("un ancla de la misma página no saca a nadie", () => {
    expect(leavingNavigationTarget("#perfil-fotos", HERE)).toBeNull();
    expect(leavingNavigationTarget("/residence/r1/profile#perfil-fotos", HERE)).toBeNull();
  });
  it("la misma ruta con otra consulta sí es otra pantalla", () => {
    expect(leavingNavigationTarget("/residence/r1/profile?tab=2", HERE)).toBe("/residence/r1/profile?tab=2");
  });
  it("un enlace externo o de otro esquema no se intercepta", () => {
    expect(leavingNavigationTarget("https://otro.com/x", HERE)).toBeNull();
    expect(leavingNavigationTarget("mailto:soporte@ejemplo.com", HERE)).toBeNull();
    expect(leavingNavigationTarget("tel:+5411", HERE)).toBeNull();
    expect(leavingNavigationTarget("javascript:void(0)", HERE)).toBeNull();
  });
  it("una URL ilegible devuelve null", () => {
    expect(leavingNavigationTarget("http://", HERE)).toBeNull();
    expect(leavingNavigationTarget("/x", "no-es-url")).toBeNull();
  });
});
