import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MiLugarContent } from "@/components/preapertura/MiLugarContent";
import type { MiLugarData } from "@/lib/preapertura/miLugar";

const student: MiLugarData = {
  role: "student", firstName: "Lu", createdAt: "2026-11-26T12:00:00Z", profilePercent: 40,
  profileComplete: false, registrationNumber: 11, invitation: null,
};
const render = (data: MiLugarData) => renderToStaticMarkup(createElement(MiLugarContent, { data }));
/** Enlaces pintados como botón naranja (la acción principal). */
const orangeLinks = (html: string) => [...html.matchAll(/<a [^>]*class="[^"]*\bbg-orange\b[^"]*"[^>]*>/g)].map((m) => m[0]);

describe("«Mi lugar»: registro listo (DR67)", () => {
  it("estudiante con el perfil incompleto: número, pasos y «Completar mi perfil» como única acción principal", () => {
    const html = render(student);
    for (const t of ["¡Listo! Ya estás adentro", "Tu número de registro", ">11<", "¿Y ahora?", "Completar mi perfil", "Seguir @estured.residencias"]) {
      expect(html).toContain(t);
    }
    expect(html.indexOf("Completar mi perfil")).toBeLessThan(html.indexOf("Seguinos en Instagram."));
    for (const t of ["persona en sumarse", "Editar mi perfil", "WhatsApp"]) expect(html).not.toContain(t);
    expect(orangeLinks(html)).toHaveLength(1);
    expect(orangeLinks(html)[0]).toContain('href="/preregistro/perfil"');
  });

  it("con el perfil completo, el botón naranja es el de Instagram y se puede editar desde el pie", () => {
    const html = render({ ...student, profileComplete: true });
    expect(html).not.toContain("Completar mi perfil");
    expect(html).toContain("Editar mi perfil");
    expect(orangeLinks(html)).toHaveLength(1);
    expect(orangeLinks(html)[0]).toContain('href="https://instagram.com/estured.residencias"');
    expect(orangeLinks(html)[0]).toContain('rel="noopener"');
  });

  it("familiar: ve su invitación, sin número ni perfil", () => {
    const html = render({
      ...student, role: "family", firstName: null, profilePercent: null, registrationNumber: null,
      invitation: { maskedEmail: "lu•••@gmail.com", status: "pending", studentFirstName: null },
    });
    expect(html).toContain("Invitamos a lu•••@gmail.com");
    for (const t of ["Tu número de registro", "Completar mi perfil", "Editar mi perfil"]) expect(html).not.toContain(t);
    expect(orangeLinks(html)).toHaveLength(1);
  });

  it("sin número guardado (0111 sin aplicar) no muestra la sección del número", () => {
    const html = render({ ...student, registrationNumber: null });
    expect(html).not.toContain("Tu número de registro");
    expect(html).toContain("Completar mi perfil");
  });

  it("una cuenta que no nació en la preapertura ve la versión básica", () => {
    const html = render({ ...student, role: null, registrationNumber: null, profilePercent: null });
    expect(html).toContain("Tu cuenta ya está lista");
    expect(html).not.toContain("Completar mi perfil");
  });
});
