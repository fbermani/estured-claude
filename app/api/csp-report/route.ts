import { clientKeyFromHeaders, createRateLimiter } from "@/lib/receipts/verifyRateLimit";

/**
 * Destino de `report-uri` de la CSP en Report-Only (auditoría S2). Solo escribe una línea en los logs de la plataforma: no toca la base,
 * no devuelve nada y no guarda IP. Es público por naturaleza (lo llama el navegador), así que: cuerpo con tope, freno por IP en memoria
 * (best-effort) y valores recortados y sin query string ni fragmento (pueden traer tokens). Se retira cuando la CSP pase a enforce.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const allowed = createRateLimiter({ limit: 30, windowMs: 60_000 });

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  const noQuery = value.split(/[?#]/)[0] ?? "";
  return noQuery.replace(/[\r\n\t]+/g, " ").slice(0, 200);
}

export async function POST(request: Request) {
  const noContent = new Response(null, { status: 204 });
  if (!allowed(clientKeyFromHeaders(request.headers))) return noContent;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return noContent;
  try {
    const text = (await request.text()).slice(0, MAX_BODY_BYTES);
    const parsed = JSON.parse(text) as unknown;
    // Formatos: `application/csp-report` ({"csp-report": {...}}) y `application/reports+json` ([{type, body}]).
    const first = Array.isArray(parsed) ? (parsed[0] as { body?: unknown } | undefined)?.body : (parsed as { "csp-report"?: unknown })["csp-report"];
    const r = (first ?? {}) as Record<string, unknown>;
    console.warn(
      `[csp-report] directiva=${clean(r["effective-directive"] ?? r["effectiveDirective"] ?? r["violated-directive"])} ` +
        `bloqueado=${clean(r["blocked-uri"] ?? r["blockedURL"])} pagina=${clean(r["document-uri"] ?? r["documentURL"])}`,
    );
  } catch {
    // Cuerpo inválido: se ignora.
  }
  return noContent;
}
