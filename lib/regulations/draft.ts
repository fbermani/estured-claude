import { MAX_REGULATION_LENGTH } from "@/lib/regulations/limits";
import { sanitizeFieldValues } from "@/lib/regulations/fields";

/**
 * Borrador local del reglamento (editor y asistente). Lógica pura. Un borrador vive solo en el dispositivo de quien edita: NO es una
 * versión del reglamento, no cuenta como aceptado ni vigente, no pausa ni reanuda solicitudes (DR14). Lo único que publica es
 * «Publicar versión nueva», por `publishRegulationVersion`.
 */

export const REGULATION_DRAFT_SCOPE = "regulation";
export const REGULATION_WIZARD_DRAFT_SCOPE = "regulation-wizard";

export type RegulationDraftData = { text: string; source: "own" | "model" };

export function sanitizeRegulationDraft(raw: unknown): RegulationDraftData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.text !== "string") return null;
  return { text: r.text.slice(0, MAX_REGULATION_LENGTH), source: r.source === "model" ? "model" : "own" };
}

export type WizardDraftData = { step: number; choices: Record<number, { included: boolean; body: string }>; fields: Record<string, string> };

/** Tope por artículo: el mismo `maxLength` del campo del asistente. */
const WIZARD_BODY_MAX = 2000;

/**
 * Sanea el progreso del asistente. Solo conserva artículos que existen en el modelo (`articleNumbers`) y acota el paso a
 * `[0, stepCount - 1]`. Devuelve null si no queda ninguna elección válida.
 */
export function sanitizeWizardDraft(raw: unknown, articleNumbers: readonly number[], stepCount: number): WizardDraftData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.choices !== "object" || r.choices === null || Array.isArray(r.choices)) return null;
  const valid = new Set(articleNumbers);
  const choices: WizardDraftData["choices"] = {};
  for (const [key, value] of Object.entries(r.choices as Record<string, unknown>)) {
    const n = Number(key);
    if (!Number.isInteger(n) || !valid.has(n)) continue;
    if (typeof value !== "object" || value === null) continue;
    const c = value as Record<string, unknown>;
    if (typeof c.included !== "boolean" || typeof c.body !== "string") continue;
    choices[n] = { included: c.included, body: c.body.slice(0, WIZARD_BODY_MAX) };
  }
  if (Object.keys(choices).length === 0) return null;
  const rawStep = typeof r.step === "number" && Number.isInteger(r.step) ? r.step : 0;
  const step = Math.min(Math.max(rawStep, 0), Math.max(stepCount - 1, 0));
  return { step, choices, fields: sanitizeFieldValues(r.fields) };
}
