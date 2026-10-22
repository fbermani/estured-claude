import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  validatePassword,
  validatePasswordWithConfirmation,
} from "@/lib/auth/password";

describe("validatePassword", () => {
  it("rechaza contraseñas por debajo del mínimo (igual que el registro)", () => {
    expect(validatePassword("1234567")).toMatch(/al menos 8 caracteres/);
    expect(validatePassword("")).not.toBeNull();
  });

  it("acepta el mínimo exacto y el máximo exacto", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    expect(validatePassword("a".repeat(MAX_PASSWORD_BYTES))).toBeNull();
  });

  it("rechaza contraseñas más largas que el máximo de bcrypt", () => {
    expect(validatePassword("a".repeat(MAX_PASSWORD_BYTES + 1))).toMatch(/demasiado larga/);
  });

  it("mide bytes UTF-8, no caracteres: ñ (2 bytes) y emoji (4 bytes) cuentan más", () => {
    // 36 × "ñ" = 36 caracteres pero exactamente 72 bytes: válido.
    expect(validatePassword("ñ".repeat(36))).toBeNull();
    // 37 × "ñ" = 37 caracteres pero 74 bytes: inválido.
    expect(validatePassword("ñ".repeat(37))).toMatch(/demasiado larga/);
    // 18 × emoji = 18 caracteres (36 unidades UTF-16) pero 72 bytes: válido; 19 → 76 bytes.
    expect(validatePassword("😀".repeat(18))).toBeNull();
    expect(validatePassword("😀".repeat(19))).toMatch(/demasiado larga/);
  });
});

describe("validatePasswordWithConfirmation", () => {
  it("exige que la confirmación coincida", () => {
    expect(validatePasswordWithConfirmation("contraseña1", "contraseña2")).toBe(
      "Las contraseñas no coinciden.",
    );
    expect(validatePasswordWithConfirmation("contraseña1", "contraseña1")).toBeNull();
  });

  it("devuelve primero el error de longitud", () => {
    expect(validatePasswordWithConfirmation("corta", "otra")).toMatch(/al menos 8/);
  });
});
