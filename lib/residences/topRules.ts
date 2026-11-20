/**
 * Reglas de convivencia destacadas (DR18, punto 9): hasta 5 ítems cortos. Se guardan igual que antes (`rules.summary`, una por línea)
 * para no romper residencias existentes. Puro y sin `server-only`.
 */
export const MAX_TOP_RULES = 5;
export const TOP_RULE_MAX = 120;

export const URL_RE = /(https?:|www\.|\b[a-z0-9-]+\.(com|ar|net|org|io|me|app|ly|co)\b|wa\.me)/i;
export const EMAIL_RE = /\S+@\S+/;

export function splitRules(summary: string): string[] {
  return summary.split("\n").map((r) => r.trim()).filter(Boolean);
}

/** Valida y normaliza las reglas enviadas (una por línea). Sin duplicados, hasta 5, cortas y sin enlaces ni emails. */
export function validateTopRules(raw: string): { ok: true; items: string[] } | { ok: false; error: string } {
  const items: string[] = [];
  const seen = new Set<string>();
  for (const line of splitRules(raw.replace(/\r\n?/g, "\n")).map((l) => l.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim())) {
    if (!line) continue;
    if (line.length > TOP_RULE_MAX) return { ok: false, error: `Una de las reglas es muy larga (máximo ${TOP_RULE_MAX} caracteres): resumila y dejá el detalle para el reglamento.` };
    if (URL_RE.test(line) || EMAIL_RE.test(line)) return { ok: false, error: "Las reglas no pueden incluir enlaces ni emails." };
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(line);
  }
  if (items.length > MAX_TOP_RULES) return { ok: false, error: `Elegí hasta ${MAX_TOP_RULES} reglas: las más importantes o las que quieras destacar.` };
  return { ok: true, items };
}
