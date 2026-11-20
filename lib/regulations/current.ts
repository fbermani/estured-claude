import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { MODEL_VERSION, buildModelText } from "@/lib/regulations/modelTemplate";
import { hashRegulationText, normalizeRegulationText } from "@/lib/regulations/text";
import { parseRegulationPdf, type RegulationPdfInfo } from "@/lib/regulations/pdfFile";

/**
 * Reglamento vigente de una residencia (DR14, docs/06 §8.7). Sin reglamento propio publicado se muestra el MODELO de EstuRed.
 * Si la migración 0053 no está aplicada degrada al modelo (`schemaReady: false`) en vez de romper la ficha o la solicitud.
 */
export type RegulationView = {
  /** Id de la versión publicada; null = modelo base (todavía sin fila: se crea al primer aceptado, ver `ensureModelVersion`). */
  versionId: string | null;
  versionNumber: number | null;
  source: "own" | "model";
  modelVersion: string | null;
  /** Texto exacto de la versión (el que se hashea). Puede traer `{campos}` si es el modelo sin adaptar: para mostrar, usar `renderPlaceholders`. */
  text: string;
  hash: string;
  publishedAt: string | null;
  /** La residencia todavía no publicó nada propio ni adaptó el modelo: rige el modelo base. */
  isBaseModel: boolean;
  schemaReady: boolean;
  /** La versión es un archivo PDF (DR62 a): `text` es solo un aviso y `hash` es el de los bytes del archivo. */
  pdf: RegulationPdfInfo | null;
};

export type RegulationVersionRow = {
  id: string;
  version_number: number;
  source: "own" | "model";
  model_version: string | null;
  content: { text?: unknown; base_model?: unknown; pdf?: unknown } | null;
  content_hash: string;
  status: "draft" | "published" | "superseded";
  published_at: string | null;
  created_at: string;
};

export const VERSION_COLUMNS = "id, version_number, source, model_version, content, content_hash, status, published_at, created_at";

export function baseModelView(schemaReady: boolean): RegulationView {
  const text = normalizeRegulationText(buildModelText());
  return {
    versionId: null,
    versionNumber: null,
    source: "model",
    modelVersion: MODEL_VERSION,
    text,
    hash: hashRegulationText(text),
    publishedAt: null,
    isBaseModel: true,
    schemaReady,
    pdf: null,
  };
}

export function viewFromRow(row: RegulationVersionRow): RegulationView {
  const text = typeof row.content?.text === "string" ? normalizeRegulationText(row.content.text) : "";
  return {
    versionId: row.id,
    versionNumber: row.version_number,
    source: row.source,
    modelVersion: row.model_version,
    text,
    hash: row.content_hash,
    publishedAt: row.published_at,
    isBaseModel: row.source === "model" && row.content?.base_model === true,
    schemaReady: true,
    pdf: parseRegulationPdf(row.content),
  };
}

/** Versión PUBLICADA de la residencia (o el modelo base). `ok: false` solo ante un error real de lectura: no hay que mostrar un reglamento que quizá no es el vigente. */
export async function loadCurrentRegulation(
  client: SupabaseClient,
  residenceId: string,
): Promise<{ ok: true; view: RegulationView } | { ok: false }> {
  const { data, error } = await client
    .from("residence_regulation_versions")
    .select(VERSION_COLUMNS)
    .eq("residence_id", residenceId)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return { ok: true, view: baseModelView(false) };
    console.error("[regulations] current read failed:", error.code, error.message);
    return { ok: false };
  }
  if (!data) return { ok: true, view: baseModelView(true) };
  const view = viewFromRow(data as RegulationVersionRow);
  // Una fila sin texto legible no es un reglamento: falla cerrado (mejor no mostrar nada que mostrar el modelo en su lugar).
  if (!view.text) return { ok: false };
  return { ok: true, view };
}

/** Historial de versiones de la residencia, de la más nueva a la más vieja. Solo para el equipo (la pantalla ya validó el acceso). */
export async function listRegulationVersions(
  client: SupabaseClient,
  residenceId: string,
): Promise<{ ok: true; versions: RegulationVersionRow[]; schemaReady: boolean } | { ok: false }> {
  const { data, error } = await client
    .from("residence_regulation_versions")
    .select(VERSION_COLUMNS)
    .eq("residence_id", residenceId)
    .neq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(50);
  if (error) {
    if (isMissingSchemaError(error)) return { ok: true, versions: [], schemaReady: false };
    console.error("[regulations] list failed:", error.code, error.message);
    return { ok: false };
  }
  return { ok: true, versions: (data ?? []) as RegulationVersionRow[], schemaReady: true };
}
