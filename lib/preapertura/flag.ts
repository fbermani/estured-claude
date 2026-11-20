import { isDevUi } from "@/lib/dev/devUi";

/**
 * Interruptor de la preapertura (DR42). `PREAPERTURA=on` enciende la capa de preapertura: `/` muestra el popup y sus pantallas
 * (`/preregistro`, `/fundadoras`, `/mi-lugar`…) y las altas clásicas quedan cortadas. Apagado, la app se comporta exactamente como antes.
 * Va en las env vars de Vercel de producción; nunca en un archivo versionado con valores reales. Sin `server-only`: lo leen también
 * tests y layouts.
 */
export function isPreaperturaOn(): boolean {
  return process.env.PREAPERTURA === "on";
}

/**
 * Preapertura «cerrada» (producción): con el flag encendido y fuera de desarrollo el sitio abierto no es navegable: solo existe el popup
 * (`next.config.ts` reescribe `/for-students` y redirige `/search`, `/waitlist` y `/students/*`; el layout público usa el header y el footer
 * de preapertura). En desarrollo el flag solo suma el popup y sus pantallas: el resto del sitio funciona como siempre.
 */
export function isPreaperturaLocked(): boolean {
  return isPreaperturaOn() && !isDevUi();
}
