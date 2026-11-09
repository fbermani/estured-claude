/**
 * Cuentas de PRUEBA autogeneradas de la preapertura (solo desarrollo). En `NODE_ENV === "development"`, enviar el registro VACÍO crea una
 * cuenta de prueba y sigue al paso siguiente, para recorrer el flujo sin tipear. En producción (y en cualquier otro entorno, incluido
 * el de los tests) esto NUNCA aplica: el envío vacío falla con la validación normal. Módulo puro: sin base ni `server-only`.
 *
 * Las cuentas son identificables por el prefijo y el dominio `.test`; `scripts/seed-preapertura-dev.mjs --borrar` las limpia.
 */
import { randomBytes } from "node:crypto";

export const DEV_ACCOUNT_PREFIX = "test-preap-";
export const DEV_ACCOUNT_DOMAIN = "estured.test";
/** Mayor de 18 con holgura; fija, así la cuenta de prueba nunca cae en el bloqueo de menores. */
export const DEV_BIRTH_DATE = "2000-01-15";

export function devAutoAccountsEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export type DevKind = "est" | "fam" | "hijo";

export function devCredentials(kind: DevKind): { email: string; password: string } {
  const rand = randomBytes(4).toString("hex");
  return {
    email: `${DEV_ACCOUNT_PREFIX}${kind}-${rand}@${DEV_ACCOUNT_DOMAIN}`,
    password: `Dev-${randomBytes(9).toString("hex")}-Aa1!`,
  };
}

/** ¿Es el mail de una cuenta de prueba autogenerada? (para el aviso «Modo dev»). */
export function isDevAutoEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").toLowerCase();
  return e.startsWith(DEV_ACCOUNT_PREFIX) && e.endsWith(`@${DEV_ACCOUNT_DOMAIN}`);
}

/** Prefijo de las solicitudes de residencia de prueba autogeneradas (envío vacío de `/register/residence` en desarrollo). `seed --borrar` las limpia. */
export const DEV_RESIDENCE_PREFIX = "test-resi-";

/** Datos de una solicitud de residencia de prueba (solo desarrollo, envío vacío). Identificable por el prefijo del mail y el nombre. */
export function devResidenceData(): { residence_name: string; address: string; contact_name: string; phone: string; email: string } {
  const rand = randomBytes(4).toString("hex");
  return {
    residence_name: `Residencia de prueba ${rand}`,
    address: "Calle de Prueba 123, CABA",
    contact_name: "Responsable de Prueba",
    phone: "+54 9 11 5555 0000",
    email: `${DEV_RESIDENCE_PREFIX}${rand}@${DEV_ACCOUNT_DOMAIN}`,
  };
}
