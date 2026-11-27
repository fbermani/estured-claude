import { describe, expect, it } from "vitest";
import { buildStudentWelcomeEmail } from "@/lib/preapertura/studentWelcomeEmail";

const profileUrl = "https://estured.com/preregistro/perfil";
const adult = buildStudentWelcomeEmail({ isMinor: false, registrationNumber: 23, profileUrl });
const minor = buildStudentWelcomeEmail({ isMinor: true, registrationNumber: 24, profileUrl });
const FIRST = "¡Serás de los primeros en poder elegir una residencia verificada!";

describe("mail de bienvenida al estudiante", () => {
  it("lleva asunto, botón al perfil, imagen propia y avisa que todavía no abrimos", () => {
    expect(adult.subject).toBe("¡Listo! Ya estás en EstuRed");
    expect(adult.html).toContain(`href="${profileUrl}"`);
    expect(adult.html).toContain("Completar mi perfil");
    expect(adult.html).toContain("/email/bienvenida.png");
    expect(adult.html).toContain("Todavía no abrimos");
    expect(adult.html).toContain("Si no fuiste vos");
  });

  it("junto al número dice algo positivo; sin número guardado, la frase queda y el número no se menciona", () => {
    expect(adult.html).toContain("Tu número de registro");
    expect(adult.html).toContain(">23<");
    expect(adult.html).toContain(FIRST);
    expect(adult.html).not.toContain("No da prioridad");
    const sinNumero = buildStudentWelcomeEmail({ isMinor: false, registrationNumber: null, profileUrl });
    expect(sinNumero.html).toContain(FIRST);
    expect(sinNumero.html).not.toContain("número de registro");
  });

  it("«¿Por qué EstuRed?» cuenta por qué reservar por EstuRed", () => {
    for (const { html } of [adult, minor]) {
      for (const text of ["¿Por qué EstuRed?", "Residencias verificadas en persona", "antes de elegir", "código y QR", "caso de Soporte", "por fuera"]) {
        expect(html).toContain(text);
      }
    }
  });

  it("une el perfil con la comunidad y muestra una habitación, aclarando que son datos de ejemplo", () => {
    for (const text of [
      "Con tu perfil completo, vamos a poder recomendarte mejor.",
      "quiénes viven en cada residencia",
      "/email/habitacion.png",
      "datos de ejemplo",
      "Es opcional",
      "nombre sin apellido, edad, país, carrera, hábitos e intereses",
      "Cualquiera puede verla",
    ]) {
      expect(adult.html).toContain(text);
    }
    expect(adult.html.indexOf("¿Por qué EstuRed?")).toBeLessThan(adult.html.indexOf("recomendarte mejor"));
  });

  it("no promete lo que no va a pasar: ni residencias mirando búsquedas ni pedidos de contacto", () => {
    for (const { html } of [adult, minor]) {
      expect(html).not.toMatch(/tu búsqueda|sin tu nombre ni contacto|se interesa|vos decidís|nunca la ve/i);
      expect(html).not.toMatch(/garantiz|asegur|mediaci|solicit[áa]r|gratis/i);
    }
  });

  it("menor invitado: no se le ofrece aparecer en la comunidad", () => {
    expect(minor.html).toContain("Por tu edad, tu perfil no aparece en la comunidad.");
    expect(minor.html).not.toMatch(/Es opcional|Cualquiera puede verla/);
    expect(minor.html).toContain("/email/habitacion.png");
    expect(minor.html).toContain(`href="${profileUrl}"`);
  });
});
