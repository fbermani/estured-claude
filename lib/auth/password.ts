/**
 * Reglas mínimas de contraseña (Fase 2 / H13). Misma regla que el registro
 * (mínimo 8 caracteres), compartida entre registro y reset de contraseña.
 * Tope de 72 BYTES (no caracteres): bcrypt (Supabase Auth) trunca/rechaza
 * más que eso y la ñ, los acentos y los emojis ocupan 2-4 bytes en UTF-8.
 * Módulo puro, sin dependencias de servidor.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

/** Devuelve el mensaje de error (en español) o null si la contraseña es válida. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "La contraseña es demasiado larga. Acortala un poco: las letras con acento, la ñ y los emojis cuentan más que una letra común.";
  }
  return null;
}

/** Valida la contraseña nueva y que la confirmación coincida. */
export function validatePasswordWithConfirmation(
  password: string,
  confirmation: string,
): string | null {
  const error = validatePassword(password);
  if (error) return error;
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return null;
}
