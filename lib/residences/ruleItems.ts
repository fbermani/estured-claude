/**
 * Reglas de casa estructuradas (ficha pública, capítulo «Reglas de casa»). Lógica pura, sin `server-only`.
 *
 * Se guardan en `residence_profile_sections.rules.items` (jsonb existente, sin migración), junto al `summary` de siempre: cada fila es
 * `{ lead?, title, detail? }` (hasta 6). `lead` es el dato grande de la columna izquierda («23 a 7», «Libre», «No»), `title` el título en
 * negrita y `detail` la línea de abajo. El `summary` (una regla por línea) se DERIVA de los ítems al guardar para que el admin, la
 * fortaleza del perfil y las pantallas viejas sigan leyendo lo mismo.
 */
import { EMAIL_RE, URL_RE } from "@/lib/residences/topRules";

export const MAX_RULE_ITEMS = 6;
export const RULE_LEAD_MAX = 12;
export const RULE_TITLE_MAX = 40;
export const RULE_DETAIL_MAX = 120;

export type HouseRuleItem = { lead?: string; title: string; detail?: string };

/** Sin caracteres de control, espacios repetidos ni bordes. */
export function cleanRuleText(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim() : "";
}

/**
 * Lectura tolerante (ficha pública): del jsonb guardado deja solo las filas bien formadas (con título), recortadas y hasta 6. Nunca lanza.
 */
export function parseRuleItems(raw: unknown): HouseRuleItem[] {
  if (!Array.isArray(raw)) return [];
  const out: HouseRuleItem[] = [];
  for (const row of raw) {
    if (out.length >= MAX_RULE_ITEMS) break;
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = cleanRuleText(r.title).slice(0, RULE_TITLE_MAX);
    if (!title) continue;
    const lead = cleanRuleText(r.lead).slice(0, RULE_LEAD_MAX);
    const detail = cleanRuleText(r.detail).slice(0, RULE_DETAIL_MAX);
    out.push({ ...(lead ? { lead } : {}), title, ...(detail ? { detail } : {}) });
  }
  return out;
}

/**
 * Validación estricta (servidor, al guardar el perfil): descarta filas vacías, recorta, y rechaza HTML, enlaces, emails, textos largos,
 * filas sin título y más de 6 reglas. Los duplicados (mismo dato y título) se descartan. El mensaje de error es para el dueño.
 */
export function normalizeRuleItems(raw: unknown): { ok: true; items: HouseRuleItem[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "No pudimos leer las reglas principales. Probá de nuevo." };
  const items: HouseRuleItem[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const lead = cleanRuleText(r.lead);
    const title = cleanRuleText(r.title);
    const detail = cleanRuleText(r.detail);
    if (!lead && !title && !detail) continue;
    if (!title) return { ok: false, error: "Cada regla necesita un título (por ejemplo, «Silencio»)." };
    for (const [field, text, max] of [
      ["El dato", lead, RULE_LEAD_MAX],
      ["El título", title, RULE_TITLE_MAX],
      ["El detalle", detail, RULE_DETAIL_MAX],
    ] as const) {
      if (text.length > max) return { ok: false, error: `${field} de una regla es muy largo (máximo ${max} caracteres): resumilo y dejá el detalle para el reglamento.` };
      if (/[<>]/.test(text)) return { ok: false, error: "Las reglas no pueden incluir los símbolos < ni >." };
      if (URL_RE.test(text) || EMAIL_RE.test(text)) return { ok: false, error: "Las reglas no pueden incluir enlaces ni emails." };
    }
    const key = `${lead.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ...(lead ? { lead } : {}), title, ...(detail ? { detail } : {}) });
  }
  if (items.length > MAX_RULE_ITEMS) return { ok: false, error: `Cargá hasta ${MAX_RULE_ITEMS} reglas principales: las más importantes. El resto va en el reglamento.` };
  return { ok: true, items };
}

/** `summary` derivado (una regla por línea): «23 a 7 · Silencio: Para música o videos, auriculares». Lo leen el admin y las pantallas viejas. */
export function ruleItemsToSummary(items: HouseRuleItem[]): string {
  return items.map((i) => `${i.lead ? `${i.lead} · ${i.title}` : i.title}${i.detail ? `: ${i.detail}` : ""}`).join("\n");
}

/** Igualdad por contenido (para no tratar como cambio —y no pedir revisión— lo que el dueño no tocó). */
export function sameRuleItems(a: HouseRuleItem[], b: HouseRuleItem[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Mueve la fila `from` a la posición `to` (límites ignorados). Devuelve una lista nueva; el editor la usa para subir/bajar. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
