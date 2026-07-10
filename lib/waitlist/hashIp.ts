import "server-only";

/**
 * SHA-256 de la IP en hex — nunca se guarda la IP en texto plano
 * (GAPS.md "Sin rate limiting..."). Web Crypto (`crypto.subtle`) en vez
 * de `node:crypto` para no atarse al runtime nodejs.
 */
export async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
