import { describe, expect, it } from "vitest";
import { buildPasswordResetTemplate } from "@/lib/email/passwordResetTemplate";

describe("plantilla de recuperar contraseña (se pega en Supabase)", () => {
  const html = buildPasswordResetTemplate();
  it("usa el link de Supabase en el botón e imágenes de estured.com", () => {
    expect(html).toContain('href="{{ .ConfirmationURL }}"');
    expect(html).toContain('src="https://estured.com/email/cuenta.png"');
    expect(html).not.toContain("localhost");
  });
  it("la copia para pegar está al día", async () => {
    await expect(`${html}\n`).toMatchFileSnapshot("../../docs/mail/recuperar-contrasena.html");
  });
});
