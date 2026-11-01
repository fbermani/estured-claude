/** Estado compartido de los formularios de registro: error global + errores por campo + valores no sensibles para repoblar. */
export type RegisterFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** name del campo -> mensaje. Solo cuando la validación puede identificar el campo. */
  fieldErrors?: Record<string, string>;
  /** Valores tipeados no sensibles (nunca contraseñas ni consentimientos) para no perderlos tras un error. */
  values?: Record<string, string>;
};

const NEVER_ECHO = new Set(["password", "invite"]);

function safeValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || NEVER_ECHO.has(key) || /pass|token/i.test(key) || key.startsWith("accept_") || key === "community_opt_in") continue;
    if (key.startsWith("$ACTION")) continue;
    out[key] = value;
  }
  return out;
}

/** Devuelve el error; `field` (name del input) lo marca en línea además del mensaje global. */
export function formError(formData: FormData, message: string, field?: string): RegisterFormState {
  return {
    status: "error",
    message,
    ...(field ? { fieldErrors: { [field]: message } } : {}),
    values: safeValues(formData),
  };
}
