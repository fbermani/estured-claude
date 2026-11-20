/**
 * Reglas de casa principales de la ficha (capítulo «Reglas de casa»). Lógica pura.
 *
 * La residencia carga un resumen de convivencia en `residence_profile_sections.rules.summary`, una regla por línea (el campo
 * `highlightedRules` de `types/domain.ts` solo existe en el modelo del catálogo y hoy viaja vacío: la fuente real es este resumen).
 * Se muestran hasta `RULES_VISIBLE` a la vista y el resto queda en un desplegable: ninguna regla se pierde.
 * Desde la fase de reglas estructuradas, `rules.items` (hasta 6 `{ lead?, title, detail? }`, ver `ruleItems.ts`) manda sobre el resumen.
 */
import { parseRuleItems, type HouseRuleItem } from "@/lib/residences/ruleItems";

/** Igual al máximo de reglas estructuradas (`MAX_RULE_ITEMS`): las 6 que carga la residencia se ven sin desplegable. */
export const RULES_VISIBLE = 6;

/** Una regla por línea; saca viñetas («-», «•», «*») y numeración («1.», «2)») que la residencia pudo haber tipeado. */
export function parseRuleLines(summary: string | null | undefined): string[] {
  return (summary ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-•*·–—]+|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean);
}

/**
 * Separa «Título: detalle» (la forma en que muchas residencias escriben cada regla) para mostrar el título destacado y el detalle abajo,
 * como en el mockup («Silencio» / «Para música o videos, auriculares»). Solo parte si el título es corto (≤ 40 caracteres) y queda un
 * detalle; si no, la regla entera es el cuerpo. Nunca se inventa ni se recorta texto.
 */
export function splitRuleLine(rule: string): { title: string | null; body: string } {
  const i = rule.indexOf(":");
  if (i > 0 && i <= 40) {
    const title = rule.slice(0, i).trim();
    const body = rule.slice(i + 1).trim();
    if (title && body && !/https?$/i.test(title)) return { title, body };
  }
  return { title: null, body: rule };
}

/** Quita los «:00» de una hora tipeada («23:00» → «23», «7:30» queda igual). */
const trimHour = (h: string) => h.replace(/:00$/, "");

/**
 * Columna izquierda de cada regla en el mockup («23 a 7», «Libre», «No»): un dato corto que se LEE del texto de la regla, nunca se inventa.
 *   - Un rango horario escrito en la regla («de 23 a 7», «de 23:00 a 7:00 hs»): «23 a 7». Con un horario con «:» o «hs/h/horas» alcanza;
 *     sin marca, solo si va precedido de «de/desde/entre» y alguna hora es mayor a 12 (evita «de 2 a 4 personas»).
 *   - La regla empieza con «No …» o dice «No se admiten/permiten/aceptan…»: «No».
 *   - La regla (o su detalle) empieza con «libre» (salvo «libre de …») o su título termina en «libre»: «Libre». Empieza con «Sí»: «Sí».
 * Sin ninguna de esas formas devuelve `null` y la fila lleva un ícono neutro en vez de un dato.
 */
export function ruleLead(rule: string): string | null {
  const text = rule.trim();
  const range = /(?:\b(de|desde|entre)\s+)?\b(\d{1,2}(?::\d{2})?)\s*(h|hs|hrs|horas)?\s*(?:a|-|–|—|hasta)\s*(?:las\s+)?(\d{1,2}(?::\d{2})?)\s*(h|hs|hrs|horas)?\b/i.exec(text);
  if (range) {
    const [, lead, from, unitA, to, unitB] = range;
    const valid = (t: string) => {
      const [h, m] = t.split(":");
      return parseInt(h, 10) <= 24 && (m === undefined || parseInt(m, 10) <= 59);
    };
    const marked = from.includes(":") || to.includes(":") || !!unitA || !!unitB;
    const bigHour = Math.max(parseInt(from, 10), parseInt(to, 10)) > 12;
    if (valid(from) && valid(to) && (marked || (!!lead && bigHour))) return `${trimHour(from)} a ${trimHour(to)}`;
  }
  const { title, body } = splitRuleLine(text);
  if (/^no\b/i.test(text) || (title && /^no\s+(se\s+)?(admit|permit|acept)/i.test(body))) return "No";
  // «Libre» solo cuando es inequívoco: la regla (o su detalle) empieza con «libre», o el título dice «… libre» («Entrada libre: …»).
  if (/^libres?\b(?!\s+de\b)/i.test(title ? body : text) || (title != null && /\blibres?\s*$/i.test(title))) return "Libre";
  if (/^sí(?![\p{L}])/iu.test(title ? body : text)) return "Sí";
  return null;
}

/** Parte las reglas en las que van a la vista y las que quedan en el desplegable (el orden se conserva). */
export function splitRules<T>(rules: T[], visible: number = RULES_VISIBLE): { primary: T[]; more: T[] } {
  const limit = Math.max(0, Math.floor(visible));
  return { primary: rules.slice(0, limit), more: rules.slice(limit) };
}

/** Texto del desplegable: «Ver 1 regla más» / «Ver 3 reglas más». */
export function moreRulesLabel(count: number): string {
  return `Ver ${count} ${count === 1 ? "regla más" : "reglas más"}`;
}

/**
 * ¿Se ofrece «Descargar el reglamento»? Solo si la residencia cargó el suyo: un reglamento propio o adaptado del modelo (no el
 * modelo base que rige mientras no publicó nada), o un PDF subido. Con el modelo base se puede leer, pero no se ofrece como descarga.
 */
export function canDownloadRegulation(params: { regulation: { isBaseModel: boolean } | null; hasUploadedPdf: boolean }): boolean {
  return params.hasUploadedPdf || (params.regulation != null && !params.regulation.isBaseModel);
}

/** Una fila de la lista de reglas de la ficha: dato grande de la izquierda (o ícono neutro si es `null`), título en negrita y detalle. */
export type RuleRow = { lead: string | null; title: string | null; body: string };

/** Largo máximo de un fragmento al partir un resumen de una sola línea (más largo = es una oración, no una regla corta). */
const FRAGMENT_MAX = 70;

/**
 * Líneas de reglas de un resumen de texto libre. Una por línea; si el resumen es UNA sola línea sin «Título: detalle» y se puede partir
 * por «;», «.» o «,» en ≥ 2 fragmentos cortos, cada fragmento pasa a ser una regla (capitalizada y sin punto final). Si no, queda tal cual:
 * nunca se recorta ni se inventa texto.
 */
export function summaryToRuleLines(summary: string | null | undefined): string[] {
  const lines = parseRuleLines(summary);
  if (lines.length !== 1 || lines[0].includes(":")) return lines;
  const parts = lines[0]
    .split(/;|\.(?=\s|$)|,(?=\s)/)
    .map((p) => p.trim().replace(/[.;,]+$/, "").trim())
    .filter(Boolean)
    .map((p) => p.charAt(0).toLocaleUpperCase("es-AR") + p.slice(1));
  return parts.length >= 2 && parts.every((p) => p.length >= 3 && p.length <= FRAGMENT_MAX) ? parts : lines;
}

/**
 * Filas de «Reglas de casa»: si la residencia cargó reglas estructuradas (`items`), esas, tal cual (dato, título y detalle); si no, las que
 * se derivan del resumen de texto (`summaryToRuleLines` + `splitRuleLine` + `ruleLead`). Sin ninguna de las dos, no hay filas.
 */
export function buildRuleRows(input: { items?: unknown; summary?: string | null }): RuleRow[] {
  const items: HouseRuleItem[] = parseRuleItems(input.items);
  if (items.length > 0) return items.map((i) => ({ lead: i.lead ?? null, title: i.title, body: i.detail ?? "" }));
  return summaryToRuleLines(input.summary).map((line) => {
    const { title, body } = splitRuleLine(line);
    return { lead: ruleLead(line), title, body };
  });
}
