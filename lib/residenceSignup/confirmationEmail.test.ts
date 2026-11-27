import { describe, expect, it } from "vitest";
import { buildResidenceConfirmationEmail, escapeHtml, safeSubjectName } from "@/lib/residenceSignup/confirmationEmail";

const base = { contactName: "Ricardo Pérez", residenceName: "Residencia Los Andes", address: "Av. Córdoba 1234, CABA", contactEmail: "hola@estured.com" };

describe("mail de confirmación de la solicitud de residencia", () => {
  it("saluda con el nombre de pila y nombra la residencia y la dirección", () => {
    const { subject, html } = buildResidenceConfirmationEmail({ ...base, place: "cupo" });
    expect(subject).toBe("Recibimos la solicitud de Residencia Los Andes");
    expect(html).toContain("Hola, Ricardo:");
    expect(html).not.toContain("Pérez");
    expect(html).toContain("Av. Córdoba 1234, CABA");
  });
  it("con lugar de fundadora lo dice; con los 15 en proceso no promete; cerrada o sin dato no menciona el cupo", () => {
    expect(buildResidenceConfirmationEmail({ ...base, place: "cupo" }).html).toContain("ocupa uno de los 15 lugares");
    expect(buildResidenceConfirmationEmail({ ...base, place: "lleno" }).html).toContain("los 15 lugares están en proceso");
    expect(buildResidenceConfirmationEmail({ ...base, place: "lleno" }).html).not.toContain("ocupa uno");
    for (const place of ["cerrado", "unknown"] as const) {
      expect(buildResidenceConfirmationEmail({ ...base, place }).html).not.toContain("Residencias fundadoras:");
    }
  });
  it("no menciona planes, precios ni comisión", () => {
    const { html } = buildResidenceConfirmationEmail({ ...base, place: "cupo" });
    expect(html).not.toMatch(/comisi[oó]n|precio|\$|USD/i);
  });
  it("escapa lo que escribió la persona (no se inyecta HTML en el mail)", () => {
    const { html } = buildResidenceConfirmationEmail({ ...base, residenceName: '<img src=x onerror="a">', contactName: "<b>Ana</b>", address: "Calle <script>1</script>", place: "cupo" });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img src=x onerror=&quot;a&quot;&gt;");
    expect(escapeHtml(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&#39;");
  });
  it("el asunto no admite saltos de línea ni caracteres de control y acota el nombre a 80 caracteres", () => {
    const evil = "Residencia\r\nBcc: victima@example.com\u0000\u2028X";
    const { subject } = buildResidenceConfirmationEmail({ ...base, residenceName: evil, place: "cupo" });
    expect(subject).not.toMatch(/[\r\n\u0000\u2028]/);
    expect(subject.startsWith("Recibimos la solicitud de Residencia Bcc: victima@example.com")).toBe(true);
    const long = buildResidenceConfirmationEmail({ ...base, residenceName: "A".repeat(300), place: "cupo" }).subject;
    expect(long).toBe(`Recibimos la solicitud de ${"A".repeat(79)}…`);
    expect(safeSubjectName("Corta")).toBe("Corta");
  });
});
