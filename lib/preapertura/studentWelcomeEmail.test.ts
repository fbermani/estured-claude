import { describe, expect, it } from "vitest";
import { buildStudentWelcomeEmail } from "@/lib/preapertura/studentWelcomeEmail";

const profileUrl = "https://estured.com/preregistro/perfil";
const adult = buildStudentWelcomeEmail({ isMinor: false, registrationNumber: 23, profileUrl });
const minor = buildStudentWelcomeEmail({ isMinor: true, registrationNumber: 24, profileUrl });

describe("mail de bienvenida al estudiante", () => {
  it("lleva asunto, botón al perfil, imagen propia y avisa que todavía no abrimos", () => {
    expect(adult.subject).toBe("¡Listo! Ya estás en EstuRed");
    expect(adult.html).toContain(`href="${profileUrl}"`);
    expect(adult.html).toContain("Completar mi perfil");
    expect(adult.html).toContain("/email/bienvenida.png");
    expect(adult.html).toContain("Todavía no abrimos");
    expect(adult.html).toContain("Si no fuiste vos");
  });

  it("muestra el número de registro sin dar prioridad; sin número guardado, no lo menciona", () => {
    expect(adult.html).toContain("Tu número de registro");
    expect(adult.html).toContain(">23<");
    expect(adult.html).toContain("No da prioridad para conseguir un lugar.");
    const sinNumero = buildStudentWelcomeEmail({ isMinor: false, registrationNumber: null, profileUrl });
    expect(sinNumero.html).not.toMatch(/número de registro|prioridad/i);
  });

  it("explica para qué sirve el perfil y la comunidad, con los límites de los Términos", () => {
    for (const text of [
      "Lo necesitamos para mostrarte residencias que te sirvan.",
      "sin tu nombre ni contacto",
      "vos decidís",
      "La residencia donde vivís hoy nunca la ve.",
      "quiénes viven en cada residencia",
      "Es opcional",
      "nombre sin apellido, edad, país, carrera, hábitos e intereses",
      "Cualquiera puede verla",
    ]) {
      expect(adult.html).toContain(text);
    }
  });

  it("menor invitado: ni comunidad para activar ni búsqueda visible para residencias", () => {
    expect(minor.html).toContain("tu perfil no aparece en la comunidad y tu búsqueda no se muestra a residencias");
    expect(minor.html).not.toMatch(/Es opcional|Cualquiera puede verla|sin tu nombre ni contacto|quiénes viven|vos decidís/);
    expect(minor.html).toContain(`href="${profileUrl}"`);
  });

  it("no promete disponibilidad ni reserva", () => {
    for (const { html } of [adult, minor]) expect(html).not.toMatch(/garantiz|reserv|disponib|solicit[áa]r/i);
  });
});
