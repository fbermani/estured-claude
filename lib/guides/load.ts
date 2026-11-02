import "server-only";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";
import { isPublishableStatus, parseGuide } from "./parse";
import { isValidGuideCtaHref } from "./routes";
import type { Guide, GuideSummary } from "./types";

const GUIDES_DIR = path.join(process.cwd(), "content", "guias");

let memo: Guide[] | null = null;

/** Lee y parsea `content/guias/*.md` (solo guías publicables). Una guía rota se omite y se registra, no tumba el hub. */
export function readGuidesFromDir(dir: string = GUIDES_DIR): Guide[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch (e) {
    console.error("[guias] no se pudo leer la carpeta de contenido:", e);
    return [];
  }
  const guides: Guide[] = [];
  const slugs = new Set<string>();
  for (const file of files) {
    const id = file.replace(/\.md$/, "");
    try {
      const guide = parseGuide(id, fs.readFileSync(path.join(dir, file), "utf8"));
      if (!isPublishableStatus(guide.status)) continue;
      if (slugs.has(guide.slug)) {
        console.error(`[guias] slug repetido «${guide.slug}» en ${file}: se omite`);
        continue;
      }
      slugs.add(guide.slug);
      guides.push(guide);
    } catch (e) {
      console.error(`[guias] ${file} no se pudo procesar:`, e);
    }
  }
  const validSlugs = new Set(guides.map((g) => g.slug));
  for (const g of guides) {
    // CTA solo si la ruta existe; relacionadas solo si existen.
    if (g.cta && !isValidGuideCtaHref(g.cta.href, validSlugs)) g.cta = undefined;
    g.relatedGuideIds = g.relatedGuideIds.filter((rid) => guides.some((x) => x.id === rid && x.id !== g.id));
  }
  return guides.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "es"));
}

/** Producción: cache en memoria del proceso. Desarrollo: relee (así un `.md` nuevo aparece sin reiniciar). */
export const getAllGuides = cache((): Guide[] => {
  if (process.env.NODE_ENV === "production") {
    memo ??= readGuidesFromDir();
    return memo;
  }
  return readGuidesFromDir();
});

export function getGuideBySlug(slug: string): Guide | undefined {
  return getAllGuides().find((g) => g.slug === slug);
}

export function getRelatedGuides(guide: Guide): Guide[] {
  const all = getAllGuides();
  return guide.relatedGuideIds.map((id) => all.find((g) => g.id === id)).filter((g): g is Guide => !!g);
}

export function toSummary(g: Guide): GuideSummary {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    description: g.description,
    category: g.category,
    audience: g.audience,
    featured: g.featured,
    readMinutes: g.readMinutes,
    ...(g.heroImage ? { heroImage: g.heroImage } : {}),
  };
}
