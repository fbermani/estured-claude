import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_IMAGES, emailButton, renderEmail } from "@/lib/email/layout";
import { SITE_URL } from "@/lib/siteUrl";

const base = { preheader: "Resumen corto", title: "Título del mail", bodyHtml: "<p>Cuerpo</p>", footerNote: "Nota al pie." };

describe("plantilla común de los mails", () => {
  it("incluye resumen oculto, título, cuerpo, nota al pie y contacto", () => {
    const html = renderEmail({ ...base, hero: "cuenta" });
    for (const piece of ["Resumen corto", "Título del mail", "<p>Cuerpo</p>", "Nota al pie.", "mailto:hola@estured.com"]) {
      expect(html).toContain(piece);
    }
  });
  it("usa imágenes PNG con URL absoluta y texto alternativo, que existen en public/", () => {
    const html = renderEmail({ ...base, hero: "invitacion" });
    const images = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
    expect(images).toHaveLength(2);
    for (const img of images) {
      expect(img).toContain(`src="${SITE_URL}/email/`);
      expect(img).toMatch(/\.png"/);
      expect(img).toMatch(/ alt="[^"]*"/);
    }
    for (const file of Object.values(EMAIL_IMAGES)) expect(existsSync(join(process.cwd(), "public/email", file))).toBe(true);
  });
  it("invita a seguir el Instagram, con el usuario escrito", () => {
    const html = renderEmail({ ...base, hero: "cuenta" });
    expect(html).toContain("Seguinos en Instagram:");
    expect(html).toContain("@estured.residencias</a>");
    expect(html.split("instagram.com/estured.residencias").length - 1).toBe(1);
  });
  it("se entiende sin imágenes: la marca va escrita", () => {
    expect(renderEmail({ ...base, hero: "cuenta" }).replace(/<img [^>]*>/g, "")).toContain("EstuRed");
  });
  it("escapa título, resumen y nota; el botón escapa el texto y el link", () => {
    const html = renderEmail({ ...base, hero: "cuenta", title: "<b>x</b>", preheader: '"p"', footerNote: "a & b" });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("&quot;p&quot;");
    expect(html).toContain("a &amp; b");
    const button = emailButton('https://estured.com/x?a="1"', "<Ir>");
    expect(button).toContain('href="https://estured.com/x?a=&quot;1&quot;"');
    expect(button).toContain("&lt;Ir&gt;");
  });
});
