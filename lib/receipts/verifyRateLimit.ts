/**
 * Límite de consultas por número de comprobante en `/verify` (H14): frena un
 * barrido automático del número corto. Es en memoria y por instancia
 * (best-effort en serverless): encarece el barrido pero NO es el control de
 * producción. **El límite real va en el WAF / Firewall de Vercel sobre
 * `/verify/*`** (pendiente, anotado en MEMORY.md Ciclo 47); esto es una
 * segunda barrera barata que no necesita tablas ni migraciones.
 */
export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }) {
  // Map conserva el orden de inserción: la primera clave es la más vieja.
  const hits = new Map<string, number[]>();
  const maxKeys = options.maxKeys ?? 5000;

  return function isAllowed(key: string, now: number = Date.now()): boolean {
    const windowStart = now - options.windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
    // Se reinserta para que la clave activa quede como la más nueva.
    hits.delete(key);
    const allowed = recent.length < options.limit;
    if (allowed) recent.push(now);
    hits.set(key, recent);

    // Tope duro: si hay demasiadas claves, primero se descartan las vencidas y, si sigue
    // pasado el tope, las más viejas por orden de inserción aunque no hayan vencido.
    if (hits.size > maxKeys) {
      for (const [k, times] of hits) {
        if (times.every((t) => t <= windowStart)) hits.delete(k);
      }
      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
    }
    return allowed;
  };
}

/**
 * Clave de cliente para el límite. Prefiere las cabeceras que pone la
 * plataforma (`x-vercel-forwarded-for`, `x-real-ip`) porque el primer
 * elemento de `x-forwarded-for` lo puede escribir el propio cliente. Sin
 * ninguna IP usa un único bucket compartido "unknown" (límite global), en
 * vez de no limitar.
 */
export function clientKeyFromHeaders(headers: { get(name: string): string | null }): string {
  const platform = headers.get("x-vercel-forwarded-for") ?? headers.get("x-real-ip");
  const candidate = platform ?? headers.get("x-forwarded-for")?.split(",")[0];
  const trimmed = candidate?.trim();
  return trimmed ? trimmed.slice(0, 64) : "unknown";
}

/** 20 búsquedas por número por minuto y por IP (o en total, para el bucket "unknown"). */
export const verifyByNumberAllowed = createRateLimiter({ limit: 20, windowMs: 60_000 });
