import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withInstagram } from "@/lib/email/sendEmail";

describe("Instagram en todos los mails", () => {
  it("lo agrega a un mail que no usa la plantilla", () => {
    const html = withInstagram("<p>Hola</p>");
    expect(html).toContain("<p>Hola</p>");
    expect(html).toContain('href="https://instagram.com/estured.residencias"');
    expect(html).toContain("@estured.residencias");
  });
  it("en un documento completo queda dentro del cuerpo", () => {
    expect(withInstagram("<html><body><p>x</p></body></html>")).toMatch(/@estured\.residencias<\/a><\/p><\/body>/);
  });
  it("no lo repite si el mail ya lo trae", () => {
    const once = withInstagram("<p>Hola</p>");
    expect(withInstagram(once)).toBe(once);
  });
});
