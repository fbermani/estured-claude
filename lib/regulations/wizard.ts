import { MODEL_ARTICLES, buildModelText, type ModelArticle } from "@/lib/regulations/modelTemplate";

/**
 * Asistente paso a paso del reglamento (DR18 fase 2, tanda 4, punto 9; extiende DR14). Lógica pura, sin I/O.
 * Parte del modelo de EstuRed: cada sección es un paso; cada artículo se puede incluir o no y editar. Al terminar arma el texto
 * (renumerado) que el editor publica por el flujo de siempre (`publishRegulationVersion`, permiso `profile.edit`).
 */

export type WizardSection = { name: string; articles: readonly ModelArticle[] };

/** Secciones del modelo en orden, una por paso del asistente. */
export function wizardSections(articles: readonly ModelArticle[] = MODEL_ARTICLES): WizardSection[] {
  const out: WizardSection[] = [];
  for (const a of articles) {
    const last = out[out.length - 1];
    if (last && last.name === a.section) (last.articles as ModelArticle[]).push(a);
    else out.push({ name: a.section, articles: [a] });
  }
  return out;
}

/** Texto base editable de un artículo: el nombre de la residencia ya viene completo; el resto de los `{campos}` los completa quien arma el reglamento. */
export function baseArticleBody(article: ModelArticle, residenceName: string): string {
  const name = residenceName.trim();
  return name ? article.body.replace(/\{nombre_residencia\}/g, name) : article.body;
}

export type WizardChoice = { n: number; included: boolean; body: string };

/**
 * Arma el texto final con los artículos incluidos, renumerados de corrido. Las referencias «Art. N» dentro de los textos se
 * actualizan al número nuevo; si el artículo referido quedó afuera, la referencia se reemplaza por «el artículo correspondiente».
 * Solo incluye artículos existentes en el modelo (ignora números desconocidos).
 */
export function assembleWizardText(choices: readonly WizardChoice[], articles: readonly ModelArticle[] = MODEL_ARTICLES): string {
  const byN = new Map(choices.map((c) => [c.n, c]));
  const kept = articles.filter((a) => byN.get(a.n)?.included);
  const renumber = new Map(kept.map((a, i) => [a.n, i + 1]));
  const fixRefs = (body: string) =>
    body.replace(/\bArt\.\s*(\d+)/g, (_m, n: string) => {
      const next = renumber.get(Number(n));
      return next ? `Art. ${next}` : "el artículo correspondiente";
    });
  const renumbered: ModelArticle[] = kept.map((a) => ({
    ...a,
    n: renumber.get(a.n) as number,
    body: fixRefs((byN.get(a.n)?.body ?? a.body).trim()),
  }));
  return buildModelText(renumbered);
}
