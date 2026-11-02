import "server-only";
import { getAllGuides, toSummary } from "./load";
import type { GuideAudience, GuideSummary } from "./types";

/**
 * Resuelve claves cortas («01», «R01»), ids completos o slugs a guías publicadas.
 * Si una guía no existe (o no está publicada) se omite: nunca hay enlaces rotos.
 */
export function resolveGuides(keys: string[]): GuideSummary[] {
  const all = getAllGuides();
  const out: GuideSummary[] = [];
  for (const key of keys) {
    const g = all.find((x) => x.slug === key || x.id === key || x.id.startsWith(`${key}-`));
    if (g && !out.some((o) => o.id === g.id)) out.push(toSummary(g));
  }
  return out;
}

/** Guías destacadas (`featured`) para una audiencia; si faltan, completa con las siguientes por orden. */
export function getFeaturedGuides(count: number, audience: GuideAudience = "estudiantes"): GuideSummary[] {
  const pool = getAllGuides().filter((g) => g.audience.includes(audience));
  const picked = [...pool.filter((g) => g.featured), ...pool.filter((g) => !g.featured)];
  return picked.slice(0, count).map(toSummary);
}
