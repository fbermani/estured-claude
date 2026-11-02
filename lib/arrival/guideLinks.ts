import "server-only";
import { ARRIVAL_CHECKLIST } from "@/lib/arrival/checklist";
import { resolveGuides } from "@/lib/guides/picks";

export type ResolvedArrivalGuides = {
  mainGuide: { slug: string; title: string } | null;
  guideLinks: Record<string, { slug: string; title: string }>;
};

/** Resuelve la guía 02 y las guías citadas por los ítems; las que no existen se omiten (sin enlaces rotos). */
export function resolveArrivalGuides(): ResolvedArrivalGuides {
  const keys = [...new Set(ARRIVAL_CHECKLIST.flatMap((c) => c.items.map((i) => i.guide).filter((g): g is string => !!g)))];
  const guideLinks: ResolvedArrivalGuides["guideLinks"] = {};
  for (const k of keys) {
    const g = resolveGuides([k])[0];
    if (g) guideLinks[k] = { slug: g.slug, title: g.title };
  }
  const main = resolveGuides(["02"])[0];
  return { mainGuide: main ? { slug: main.slug, title: main.title } : null, guideLinks };
}
