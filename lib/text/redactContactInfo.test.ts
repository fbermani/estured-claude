import { describe, expect, it } from "vitest";
import { CONTACT_REDACTION as R, redactContactInfo } from "@/lib/text/redactContactInfo";

describe("redactContactInfo - teléfonos", () => {
  it.each([
    ["Escribime al +54 9 11 2345-6789 cuando quieras", `Escribime al ${R} cuando quieras`],
    ["Mi número es 11-1234-5678.", `Mi número es ${R}.`],
    ["Llamame al (011) 4123-4567 por la tarde", `Llamame al ${R} por la tarde`],
    ["1123456789", R],
    ["+5491123456789", R],
    ["+54 (11) 5555 0105", R],
    ["011 4555.1234", R],
    ["cel 15 2345 6789", `cel ${R}`],
  ])("%s", (input, expected) => {
    expect(redactContactInfo(input)).toBe(expected);
  });

  it("no toca números cortos, años ni rangos de años", () => {
    const t = "Tengo 21 años, curso 3er año desde 2024, plan 2026-2030 y pago 1200 USD.";
    expect(redactContactInfo(t)).toBe(t);
  });
});

describe("redactContactInfo - emails, links y usuarios", () => {
  it("emails", () => {
    expect(redactContactInfo("mail: camila.rojas+uba@gmail.com ok")).toBe(`mail: ${R} ok`);
    expect(redactContactInfo("juan (at) hotmail.com")).toBe(R);
  });
  it("URLs y dominios", () => {
    expect(redactContactInfo("mirá https://instagram.com/cami_r?x=1 y www.miweb.com.ar/perfil")).toBe(`mirá ${R} y ${R}`);
    expect(redactContactInfo("mi blog es camila.com")).toBe(`mi blog es ${R}`);
  });
  it("@usuarios", () => {
    expect(redactContactInfo("seguime en @cami_rojas.ok por favor")).toBe(`seguime en ${R} por favor`);
  });
});

describe("redactContactInfo - menciones de redes", () => {
  it.each([
    ["Mi whatsapp es 11 2345 6789", `Mi ${R}`],
    ["wsp: 1123456789", `${R}`],
    ["mi insta es cami_rojas", `mi ${R}`],
    ["Instagram: cami.rojas99", R],
    ["telegram @cami_r", R],
  ])("%s", (input, expected) => {
    expect(redactContactInfo(input)).toBe(expected);
  });

  it("no oculta menciones sin dato ni texto normal", () => {
    const t = "Uso Instagram poco y me encanta hablar por teléfono con mi familia.";
    expect(redactContactInfo(t)).toBe(t);
    const bio = "Estudiante de Administración de Empresas, de Lima. Me gusta cocinar y el cine.";
    expect(redactContactInfo(bio)).toBe(bio);
  });

  it("junta reemplazos pegados y tolera vacío", () => {
    expect(redactContactInfo("11 2345 6789 / cami@x.com")).toBe(R);
    expect(redactContactInfo("")).toBe("");
  });
});
