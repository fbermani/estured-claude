/**
 * ¿Se muestran las herramientas de desarrollo (cerrar el popup de preapertura, «Pantallas (dev)», cuentas de prueba autogeneradas,
 * preapertura sin cortar el resto del sitio)? Sí en `next dev` y en el STAGING de Vercel, que se enciende con `NEXT_PUBLIC_STAGING=on`
 * (variable de Preview acotada a la rama `staging`, apuntando a `estured-dev`). Nunca en producción de Vercel: `VERCEL_ENV` se exige
 * del lado del servidor, y la variable no se carga en Production. Las lecturas de `process.env.*` son literales a propósito: Next las
 * incrusta en el bundle del cliente. Sin `server-only` porque lo leen también componentes cliente (solo cosmético; la protección real
 * está en las server actions, que usan este mismo helper del lado del servidor).
 */
export function isDevUi(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.NEXT_PUBLIC_STAGING === "on" && process.env.VERCEL_ENV !== "production";
}
