/** Estados que devuelven las server actions de la preapertura a sus formularios. Sin `server-only`: los importan componentes de cliente. */

type Base = {
  message?: string;
  /** name del campo -> mensaje (los pone el servidor). */
  fieldErrors?: Record<string, string>;
};

/** Paso 1 (estudiante). `minor`: menor de 18 sin invitación, no se creó cuenta (DR43.2). `success`: ya hay sesión; el cliente navega a `redirectTo`. */
export type Step1State = Base & {
  status: "idle" | "error" | "minor" | "success";
  code?: "email_exists" | "network";
  /** Valores no sensibles para repoblar tras un error (nunca la contraseña). */
  values?: { email?: string; birth_date?: string };
  redirectTo?: string;
};

export type ProfileState = Base & {
  status: "idle" | "error" | "success";
  code?: "no_session" | "network";
  redirectTo?: string;
};

export type FamilyState = Base & {
  status: "idle" | "error" | "success";
  code?: "email_exists" | "network";
  values?: { email?: string; student_email?: string };
  /** Solo en `success`: el link de la invitación (ruta relativa; se muestra una vez) y si el mail salió. */
  invitePath?: string;
  inviteeEmail?: string;
  emailSent?: boolean;
  redirectTo?: string;
};

export const NETWORK_MESSAGE = "Revisá tu conexión y probá de nuevo. Tus datos siguen acá.";
