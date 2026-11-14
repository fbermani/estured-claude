/**
 * DR38 — documentación de la estadía configurable por residencia.
 *
 * Helper PURO (sin base de datos): catálogo, default, parseo tolerante de lo guardado en
 * `residence_profile_sections` (`section_type = 'stay_documents'`), validación del formulario del dueño y el cruce
 * «requisitos de la residencia vs. archivos que el estudiante ya tiene en su perfil».
 */

export const STAY_DOCUMENTS_SECTION = "stay_documents";

export const STAY_DOCUMENT_CATALOG = [
  { key: "identity", label: "Documento de identidad o pasaporte", documentType: "student_identity" },
  { key: "academic_proof", label: "Certificado de estudios", documentType: "student_academic_proof" },
  { key: "criminal_record", label: "Antecedentes penales", documentType: "student_criminal_record" },
] as const;

export type StayDocumentKey = (typeof STAY_DOCUMENT_CATALOG)[number]["key"];
export type StayDocumentFileType = (typeof STAY_DOCUMENT_CATALOG)[number]["documentType"];

/** Lo que se pedía antes de DR38: sin configuración propia rige este default. */
export const DEFAULT_STAY_DOCUMENT_KEYS: StayDocumentKey[] = ["identity", "academic_proof"];
export const MAX_OTHER_STAY_DOCUMENTS = 5;
export const MAX_OTHER_STAY_DOCUMENT_LENGTH = 80;

export type StayDocumentsConfig = { items: StayDocumentKey[]; other: string[] };

const CATALOG_KEYS = new Set<string>(STAY_DOCUMENT_CATALOG.map((c) => c.key));

export function defaultStayDocumentsConfig(): StayDocumentsConfig {
  return { items: [...DEFAULT_STAY_DOCUMENT_KEYS], other: [] };
}

/** Texto libre de un documento «Otro»: sin HTML, sin caracteres de control, espacios colapsados. */
export function sanitizeStayDocumentLabel(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave de comparación de un «Otro»: sin mayúsculas ni tildes ni espacios de más. */
export function normalizeRequirementLabel(raw: unknown): string {
  return sanitizeStayDocumentLabel(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function orderedKeys(keys: Iterable<string>): StayDocumentKey[] {
  const set = new Set(keys);
  return STAY_DOCUMENT_CATALOG.filter((c) => set.has(c.key)).map((c) => c.key);
}

function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) {
    const norm = normalizeRequirementLabel(l);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(l);
  }
  return out;
}

/** Lee lo guardado; cualquier forma inesperada o ausente cae al default (nunca rompe una pantalla). */
export function parseStayDocumentsContent(content: unknown): StayDocumentsConfig {
  if (!content || typeof content !== "object" || Array.isArray(content)) return defaultStayDocumentsConfig();
  const raw = content as { items?: unknown; other?: unknown };
  if (!Array.isArray(raw.items) && !Array.isArray(raw.other)) return defaultStayDocumentsConfig();
  const items = orderedKeys((Array.isArray(raw.items) ? raw.items : []).map(String).filter((k) => CATALOG_KEYS.has(k)));
  const other = dedupeLabels(
    (Array.isArray(raw.other) ? raw.other : [])
      .map(sanitizeStayDocumentLabel)
      .filter((l) => l.length > 0)
      .map((l) => l.slice(0, MAX_OTHER_STAY_DOCUMENT_LENGTH)),
  ).slice(0, MAX_OTHER_STAY_DOCUMENTS);
  return { items, other };
}

export type StayDocumentsInputResult = { ok: true; value: StayDocumentsConfig } | { ok: false; error: string };

/** Valida y normaliza lo que manda el formulario del dueño (server-side). */
export function normalizeStayDocumentsInput(keys: unknown[], other: unknown[]): StayDocumentsInputResult {
  const items = orderedKeys(keys.map(String).filter((k) => CATALOG_KEYS.has(k)));
  const labels = other.map(sanitizeStayDocumentLabel).filter((l) => l.length > 0);
  if (labels.some((l) => l.length > MAX_OTHER_STAY_DOCUMENT_LENGTH))
    return { ok: false, error: `Cada documento propio puede tener hasta ${MAX_OTHER_STAY_DOCUMENT_LENGTH} caracteres.` };
  const unique = dedupeLabels(labels);
  if (unique.length > MAX_OTHER_STAY_DOCUMENTS)
    return { ok: false, error: `Podés pedir hasta ${MAX_OTHER_STAY_DOCUMENTS} documentos propios.` };
  return { ok: true, value: { items, other: unique } };
}

export type StayRequirement = {
  /** `identity` | `academic_proof` | `criminal_record` | `other:<etiqueta normalizada>` */
  id: string;
  label: string;
  kind: "standard" | "other";
  /** Valor de `files.document_type` con el que se responde. */
  documentType: StayDocumentFileType | "other";
  /** Solo en «Otro»: etiqueta que se guarda en `files.requirement_label`. */
  requirementLabel: string | null;
};

export function listStayRequirements(config: StayDocumentsConfig): StayRequirement[] {
  const standard: StayRequirement[] = STAY_DOCUMENT_CATALOG.filter((c) => config.items.includes(c.key)).map((c) => ({
    id: c.key,
    label: c.label,
    kind: "standard",
    documentType: c.documentType,
    requirementLabel: null,
  }));
  const other: StayRequirement[] = config.other.map((label) => ({
    id: `other:${normalizeRequirementLabel(label)}`,
    label,
    kind: "other",
    documentType: "other",
    requirementLabel: label,
  }));
  return [...standard, ...other];
}

/** Sin la migración 0077 solo se pueden pedir (y reconocer) los dos documentos de siempre. */
export function restrictToLegacyRequirements(requirements: StayRequirement[]): StayRequirement[] {
  return requirements.filter((r) => r.kind === "standard" && r.documentType !== "student_criminal_record");
}

export type StudentDocumentFile = {
  /** `files.id`: solo lo usan las pantallas que pueden abrir el archivo (DR48). */
  id?: string;
  document_type: string;
  requirement_label?: string | null;
  created_at?: string | null;
};

export type RequirementStatus = {
  requirement: StayRequirement;
  delivered: boolean;
  deliveredAt: string | null;
  /** Archivo más reciente que cubre el requisito (DR48: la residencia autorizada lo puede abrir). `null` si falta o no trae id. */
  fileId: string | null;
};

/** Cruza los requisitos de una residencia con los archivos que el estudiante tiene en su perfil (el más reciente de cada uno). */
export function computeRequirementStatuses(requirements: StayRequirement[], files: StudentDocumentFile[]): RequirementStatus[] {
  return requirements.map((requirement) => {
    const matches = files.filter((f) =>
      requirement.kind === "standard"
        ? f.document_type === requirement.documentType
        : f.document_type === "other" &&
          !!f.requirement_label &&
          normalizeRequirementLabel(f.requirement_label) === normalizeRequirementLabel(requirement.requirementLabel),
    );
    let deliveredAt: string | null = null;
    let fileId: string | null = null;
    for (const f of matches) {
      const at = f.created_at ?? null;
      if (at && (!deliveredAt || at > deliveredAt)) {
        deliveredAt = at;
        fileId = f.id ?? null;
      } else if (!fileId && !deliveredAt) {
        fileId = f.id ?? null;
      }
    }
    return { requirement, delivered: matches.length > 0, deliveredAt, fileId };
  });
}

export function summarizeRequirementStatuses(statuses: RequirementStatus[]): { total: number; delivered: number; missing: number } {
  const delivered = statuses.filter((s) => s.delivered).length;
  return { total: statuses.length, delivered, missing: statuses.length - delivered };
}
