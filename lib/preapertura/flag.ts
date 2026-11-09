/**
 * Interruptor de la preapertura (DR42). `PREAPERTURA=on` enciende la capa de preapertura: `next.config.ts` reescribe `/` y
 * `/for-students` y redirige `/search`, `/register` y `/waitlist`; el layout público cambia header y footer. Apagado, la app se
 * comporta exactamente como antes. Va en las env vars de Vercel de producción; nunca en un archivo versionado con valores reales.
 * Sin `server-only`: lo leen también tests y layouts.
 */
export function isPreaperturaOn(): boolean {
  return process.env.PREAPERTURA === "on";
}
