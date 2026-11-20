import {
  GUIDE_AUDIENCES,
  GUIDE_CATEGORIES,
  GUIDE_STAGES,
  type Guide,
  type GuideAudience,
  type GuideBlock,
  type GuideCategory,
  type GuideSection,
  type GuideSectionVariant,
  type GuideStage,
  type GuideStatus,
} from "./types";
import { DEFAULT_STAGE_BY_ID } from "./taxonomy";

/**
 * Parser mínimo propio (sin dependencias): frontmatter YAML simple (strings, listas, un objeto `cta`)
 * + cuerpo Markdown acotado (H1, línea de audiencia, H2/H3, párrafos, listas, **negrita** y enlaces,
 * estos dos últimos se resuelven al renderizar). Los comentarios `<!-- -->` se descartan antes de parsear.
 */

export type FrontmatterValue = string | string[] | { [key: string]: string };

export function splitFrontmatter(raw: string): { data: Record<string, FrontmatterValue>; body: string } {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return { data: {}, body: text };
  return { data: parseYaml(m[1]), body: text.slice(m[0].length) };
}

function unquote(v: string): string {
  const s = v.trim();
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return s;
}

function parseYaml(src: string): Record<string, FrontmatterValue> {
  const lines = src.split("\n");
  const data: Record<string, FrontmatterValue> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const km = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!km) {
      i++;
      continue;
    }
    const key = km[1];
    const inline = (km[2] ?? "").trim();
    i++;
    if (inline !== "") {
      // Escalar, posiblemente plegado en varias líneas indentadas.
      let value = inline;
      const quote = value[0] === "'" || value[0] === '"' ? value[0] : "";
      const closed = () => quote === "" || (value.length > 1 && value.endsWith(quote));
      while (i < lines.length && /^\s+\S/.test(lines[i]) && (quote !== "" ? !closed() : true)) {
        value += " " + lines[i].trim();
        i++;
      }
      data[key] = unquote(value);
      continue;
    }
    // Sin valor inline: lista (`- x`) u objeto (`  k: v`).
    const items: string[] = [];
    const obj: { [key: string]: string } = {};
    while (i < lines.length && /^(\s+|-\s)/.test(lines[i]) && lines[i].trim() !== "") {
      const t = lines[i].trim();
      if (t.startsWith("- ")) items.push(unquote(t.slice(2)));
      else {
        const om = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(t);
        if (om) obj[om[1]] = unquote(om[2]);
      }
      i++;
    }
    data[key] = items.length > 0 ? items : Object.keys(obj).length > 0 ? obj : "";
  }
  return data;
}

/** Ajustes SOLO de render (el .md queda intacto): encabezado y oración de la sección de fuentes oficiales. */
const RENDER_REWRITES: ReadonlyArray<[string, string]> = [
  ["## Fuentes para consultar antes de publicar", "## Fuentes oficiales para consultar"],
  ["Confirmar enlaces y trámites vigentes antes de lanzar.", "Los trámites y enlaces pueden cambiar: confirmalos en cada sitio oficial."],
];

/** `Nombre (dominio.gob.ar/ruta)` -> `[Nombre](https://dominio.gob.ar/ruta)`. */
const ORG_DOMAIN = /(^|;\s*)([^;()\n]+?) \(((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)\)/gm;

function prepareBody(body: string): string {
  let out = body.replace(/<!--[\s\S]*?-->/g, "");
  for (const [from, to] of RENDER_REWRITES) out = out.split(from).join(to);
  return out.replace(ORG_DOMAIN, (_m, pre: string, name: string, url: string) => `${pre}[${name.trim()}](https://${url})`);
}

export function slugifyHeading(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "seccion"
  );
}

function variantFor(heading: string): GuideSectionVariant {
  if (/^checklist/i.test(heading)) return "checklist";
  if (/^tu siguiente paso/i.test(heading)) return "next-step";
  if (/^una idea para recordar/i.test(heading)) return "idea";
  if (/^para las familias/i.test(heading)) return "family";
  return "default";
}

/** Texto plano (sin marcas de Markdown) para contar palabras. */
export function plainText(md: string): string {
  return md.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*/g, "");
}

export function countWords(text: string): number {
  const t = plainText(text).trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}

/** Parte «¿…? ¿…?» en preguntas individuales; devuelve null si no hay al menos dos. */
function splitQuestions(text: string): string[] | null {
  const parts = text.match(/¿[^?]*\?/g);
  if (!parts || parts.length < 2) return null;
  return parts.map((p) => p.trim());
}

function parseBlocks(lines: string[], usedIds: Set<string>, variant: GuideSectionVariant): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length >= 2) blocks.push({ type: "table", header: tableRows[0], rows: tableRows.slice(1) });
    tableRows = [];
  };
  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join(" ").trim();
    para = [];
    if (!text) return;
    const questions = variant === "checklist" ? splitQuestions(text) : null;
    if (questions) {
      // Conserva cualquier texto que no sea una pregunta (antes o después) como párrafos.
      const rest = text.split(/¿[^?]*\?/).map((s) => s.trim()).filter(Boolean);
      const lead = text.startsWith("¿") ? null : rest[0];
      const trail = text.endsWith("?") ? null : rest[rest.length - 1];
      if (lead) blocks.push({ type: "paragraph", text: lead });
      blocks.push({ type: "checklist", items: questions });
      if (trail && trail !== lead) blocks.push({ type: "paragraph", text: trail });
      return;
    }
    blocks.push({ type: "paragraph", text });
  };
  const flushList = () => {
    if (list && list.items.length > 0) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (t === "") {
      flushPara();
      flushList();
      flushTable();
      continue;
    }
    if (t.startsWith("|")) {
      flushPara();
      flushList();
      const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) tableRows.push(cells); // omite la fila separadora
      continue;
    }
    flushTable();
    const h3 = /^###\s+(.*)$/.exec(t);
    if (h3) {
      flushPara();
      flushList();
      let id = slugifyHeading(h3[1]);
      while (usedIds.has(id)) id += "-2";
      usedIds.add(id);
      blocks.push({ type: "subheading", id, text: h3[1].trim() });
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(t);
    const ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1].trim());
      continue;
    }
    if (list) {
      // Continuación de un ítem de lista.
      list.items[list.items.length - 1] += " " + t;
      continue;
    }
    para.push(t);
  }
  flushPara();
  flushList();
  flushTable();
  return blocks;
}

function asString(v: FrontmatterValue | undefined): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
function asList(v: FrontmatterValue | undefined): string[] {
  if (Array.isArray(v)) return v;
  return typeof v === "string" && v.trim() !== "" ? [v.trim()] : [];
}

export class GuideParseError extends Error {}

const PUBLISHABLE: ReadonlySet<GuideStatus> = new Set(["borrador-editorial", "published"]);
export function isPublishableStatus(status: GuideStatus): boolean {
  return PUBLISHABLE.has(status);
}

/** Parsea un archivo de guía. `id` = nombre de archivo sin `.md`. Lanza `GuideParseError` si faltan campos clave. */
export function parseGuide(id: string, raw: string): Guide {
  const { data, body: rawBody } = splitFrontmatter(raw);
  const title = asString(data.title);
  const slug = asString(data.slug);
  const description = asString(data.description);
  if (!title || !slug || !description) throw new GuideParseError(`${id}: faltan title, slug o description`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new GuideParseError(`${id}: slug inválido «${slug}»`);

  const category = asString(data.category) as GuideCategory | undefined;
  if (!category || !(GUIDE_CATEGORIES as readonly string[]).includes(category)) {
    throw new GuideParseError(`${id}: categoría inválida «${category ?? ""}»`);
  }
  const audience = asList(data.audience).filter((a): a is GuideAudience => (GUIDE_AUDIENCES as readonly string[]).includes(a));
  if (audience.length === 0) throw new GuideParseError(`${id}: audience vacío o inválido`);

  const status = (asString(data.status) ?? "draft") as GuideStatus;
  const stageRaw = asString(data.stage);
  const stage = ((GUIDE_STAGES as readonly string[]).includes(stageRaw ?? "") ? stageRaw : DEFAULT_STAGE_BY_ID[id]) as GuideStage | undefined;

  const lines = prepareBody(rawBody).split("\n");
  let idx = 0;
  const skipBlank = () => {
    while (idx < lines.length && lines[idx].trim() === "") idx++;
  };
  skipBlank();
  if (idx < lines.length && /^#\s+/.test(lines[idx])) idx++; // H1: el título sale del frontmatter
  skipBlank();
  let eyebrow: string | undefined;
  const eb = lines[idx]?.trim() ?? "";
  if (eb && !eb.startsWith("#") && /[A-ZÁÉÍÓÚÑ]/.test(eb) && eb === eb.toUpperCase()) {
    eyebrow = eb;
    idx++;
  }

  const usedIds = new Set<string>();
  const sections: GuideSection[] = [];
  const introLines: string[] = [];
  let current: { heading: string; id: string; lines: string[] } | null = null;
  const closeSection = () => {
    if (!current) return;
    const variant = variantFor(current.heading);
    sections.push({ id: current.id, heading: current.heading, variant, blocks: parseBlocks(current.lines, usedIds, variant) });
    current = null;
  };
  for (; idx < lines.length; idx++) {
    const h2 = /^##\s+(.*)$/.exec(lines[idx].trim());
    if (h2) {
      closeSection();
      const heading = h2[1].trim();
      let sid = slugifyHeading(heading);
      while (usedIds.has(sid)) sid += "-2";
      usedIds.add(sid);
      current = { heading, id: sid, lines: [] };
    } else if (current) current.lines.push(lines[idx]);
    else introLines.push(lines[idx]);
  }
  closeSection();

  // «Para seguir explorando…» se separa para mostrarlo como cierre, sin tocar su texto.
  let closingNote: string | undefined;
  for (const s of sections) {
    const at = s.blocks.findIndex((b) => b.type === "paragraph" && /^Para seguir explorando/.test(b.text));
    if (at >= 0) {
      const b = s.blocks[at];
      if (b.type === "paragraph") closingNote = b.text;
      s.blocks.splice(at, 1);
    }
  }

  const intro = parseBlocks(introLines, usedIds, "default").find((b) => b.type === "paragraph");
  const lede = intro && intro.type === "paragraph" ? intro.text : undefined;

  const allText = [lede ?? "", closingNote ?? "", ...sections.flatMap((s) => [s.heading, ...s.blocks.map((b) => (b.type === "paragraph" || b.type === "subheading" ? b.text : b.type === "list" || b.type === "checklist" ? b.items.join(" ") : ""))])].join(" ");
  const wordCount = countWords(allText);

  const ctaRaw = data.cta;
  const cta =
    ctaRaw && typeof ctaRaw === "object" && !Array.isArray(ctaRaw) && ctaRaw.label && ctaRaw.href
      ? { label: ctaRaw.label, href: ctaRaw.href }
      : undefined;

  const order = Number.parseInt(asString(data.order) ?? "", 10);
  return {
    id,
    slug,
    title,
    description,
    category,
    audience,
    status,
    order: Number.isFinite(order) ? order : 999,
    featured: asString(data.featured) === "true",
    stage,
    tags: asList(data.tags),
    eyebrow,
    lede,
    sections,
    closingNote,
    wordCount,
    readMinutes: readingMinutes(wordCount),
    relatedGuideIds: asList(data.related_guides),
    cta,
    ...(asString(data.hero_image) ? { heroImage: { src: asString(data.hero_image)!, alt: asString(data.hero_image_alt) ?? "" } } : {}),
    updatedAt: asString(data.updated_at),
    reviewedAt: asString(data.reviewed_at),
    author: asString(data.author),
    seo: {
      title: asString(data.seo_title) ?? title,
      description: asString(data.seo_description) ?? description,
    },
  };
}
