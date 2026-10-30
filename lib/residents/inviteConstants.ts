/** Constantes de la invitación personal (DR19), sin dependencias de Node: las importan también componentes de cliente. */
export const INVITE_TTL_DAYS = 14;
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Tope acumulado de intentos por invitación: pasado esto hay que regenerar la invitación desde la residencia. */
export const OTP_MAX_TOTAL_ATTEMPTS = 15;
/** Tope de códigos enviados por invitación (persistido en la base). */
export const OTP_MAX_SENDS = 6;
