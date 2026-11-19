import { COMMON_AREA_OPTIONS, SERVICE_OPTIONS, UNIVERSITY_OPTIONS } from "@/lib/residences/options";
import { MAX_RULE_ITEMS } from "@/lib/residences/ruleItems";

/**
 * Borrador local de la configuración de residencia (formulario de `profile`). Lógica pura, sin React ni almacenamiento.
 * Cubre lo que se edita en el formulario; NO cubre archivos (fotos, PDF del reglamento) ni lo que ya se guarda por su cuenta
 * (galería, promociones). Un borrador local no publica ni envía nada: el servidor solo cambia con «Guardar cambios».
 */

export const PROFILE_DRAFT_SCOPE = "profile";

export type ProfileDraftData = {
  tagline: string;
  description: string;
  services: string[];
  commonAreas: string[];
  kitchens: number;
  cleaningMode: "daily" | "weekly";
  cleaningPerWeek: number;
  nearUniversities: string[];
  stayDocKeys: string[];
  stayDocOther: string[];
  rulesRows: { lead: string; title: string; detail: string }[];
  rulesDirty: boolean;
  /** Solo los ítems «Otro» nuevos (todavía sin guardar); los ya guardados vienen del servidor. */
  newCustomItems: { kind: "service" | "area"; label: string }[];
  faqItems: { question: string; answer: string }[];
  roomTypes: Record<string, unknown>[];
  conditions: Record<string, unknown>;
};

/** Valores tal como los tiene el formulario (los `Set` y las filas con `id` se normalizan al serializar). */
export type ProfileDraftSource = {
  tagline: string;
  description: string;
  services: Iterable<string>;
  commonAreas: Iterable<string>;
  kitchens: number;
  cleaningMode: "daily" | "weekly";
  cleaningPerWeek: number;
  nearUniversities: Iterable<string>;
  stayDocKeys: Iterable<string>;
  stayDocOther: string[];
  rulesRows: { lead: string; title: string; detail: string }[];
  rulesDirty: boolean;
  customItems: { id?: string; kind: "service" | "area"; label: string }[];
  faqItems: { question: string; answer: string }[];
  roomTypes: object[];
  conditions: object;
};

const sorted = (values: Iterable<string>) => [...values].sort();

/** Foto serializable y estable (arrays ordenados) del formulario: sirve para guardar y para comparar contra lo último guardado. */
export function toProfileDraftData(src: ProfileDraftSource): ProfileDraftData {
  return {
    tagline: src.tagline,
    description: src.description,
    services: sorted(src.services),
    commonAreas: sorted(src.commonAreas),
    kitchens: src.kitchens,
    cleaningMode: src.cleaningMode,
    cleaningPerWeek: src.cleaningPerWeek,
    nearUniversities: sorted(src.nearUniversities),
    stayDocKeys: sorted(src.stayDocKeys),
    stayDocOther: [...src.stayDocOther],
    rulesRows: src.rulesRows.map((r) => ({ lead: r.lead, title: r.title, detail: r.detail })),
    rulesDirty: src.rulesDirty,
    newCustomItems: src.customItems.filter((i) => !i.id).map((i) => ({ kind: i.kind, label: i.label })),
    faqItems: src.faqItems.map((f) => ({ question: f.question, answer: f.answer })),
    roomTypes: src.roomTypes.map((r) => ({ ...r })),
    conditions: { ...src.conditions },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 5000): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function strList(v: unknown, allowed?: ReadonlySet<string>, maxItems = 60, maxLen = 200): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((x): x is string => typeof x === "string" && (!allowed || allowed.has(x)))
    .slice(0, maxItems)
    .map((x) => x.slice(0, maxLen));
}

/**
 * Toma de `raw` solo las claves de `base` cuyo valor tiene el mismo tipo que el de `base` (los campos numéricos que admiten «»
 * aceptan número o cadena vacía). Lo demás conserva el valor de `base`: un borrador viejo no puede romper el formulario si
 * cambiaron los campos.
 */
export function mergeByTemplate<T extends object>(raw: unknown, base: T): T {
  if (!isRecord(raw)) return { ...base };
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const template0 = base as Record<string, unknown>;
  for (const key of Object.keys(base)) {
    const incoming = raw[key];
    const template = template0[key];
    if (incoming === undefined) continue;
    const numberLike = typeof template === "number" || template === "";
    const ok = numberLike
      ? (typeof incoming === "number" && Number.isFinite(incoming)) || incoming === "" || (typeof template === "string" && typeof incoming === "string")
      : typeof incoming === typeof template;
    if (ok) out[key] = incoming;
  }
  return out as T;
}

const OPTIONAL_STRING_KEYS = ["id", "genderPolicy", "bathroomType"] as const;

/** Sanea los tipos de habitación guardados contra una plantilla (campos con el tipo correcto, hasta 12 tipos). */
export function sanitizeRoomTypes(raw: unknown, template: { name: string; roomCount: number; capacityPerRoom: number; monthlyPriceUsd: number }): Record<string, unknown>[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Record<string, unknown>[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!isRecord(item)) continue;
    const entry: Record<string, unknown> = {
      name: str(item.name, 80) ?? template.name,
      features: strList(item.features, undefined, 30, 80) ?? [],
      roomCount: num(item.roomCount) ?? template.roomCount,
      capacityPerRoom: num(item.capacityPerRoom) ?? template.capacityPerRoom,
      monthlyPriceUsd: num(item.monthlyPriceUsd) ?? template.monthlyPriceUsd,
    };
    for (const key of OPTIONAL_STRING_KEYS) {
      const v = str(item[key], 80);
      if (v) entry[key] = v;
    }
    out.push(entry);
  }
  return out;
}

const SERVICES = new Set<string>(SERVICE_OPTIONS);
const COMMON_AREAS = new Set<string>(COMMON_AREA_OPTIONS);
const UNIVERSITIES = new Set<string>(UNIVERSITY_OPTIONS);

/**
 * Sanea lo que se leyó del almacenamiento. Devuelve solo los campos válidos (los demás quedan como estén en el formulario) o
 * null si no hay ninguno. `conditions` y `roomTypes` se terminan de mezclar contra el estado actual al aplicarlos.
 */
export function sanitizeProfileDraft(raw: unknown): Partial<ProfileDraftData> | null {
  if (!isRecord(raw)) return null;
  const out: Partial<ProfileDraftData> = {};

  const tagline = str(raw.tagline, 200);
  if (tagline !== undefined) out.tagline = tagline;
  const description = str(raw.description);
  if (description !== undefined) out.description = description;
  const services = strList(raw.services, SERVICES);
  if (services) out.services = services;
  const commonAreas = strList(raw.commonAreas, COMMON_AREAS);
  if (commonAreas) out.commonAreas = commonAreas;
  const nearUniversities = strList(raw.nearUniversities, UNIVERSITIES);
  if (nearUniversities) out.nearUniversities = nearUniversities;
  const stayDocKeys = strList(raw.stayDocKeys, undefined, 40, 60);
  if (stayDocKeys) out.stayDocKeys = stayDocKeys;
  const stayDocOther = strList(raw.stayDocOther, undefined, 20, 80);
  if (stayDocOther) out.stayDocOther = stayDocOther;

  const kitchens = num(raw.kitchens);
  if (kitchens !== undefined) out.kitchens = kitchens;
  const perWeek = num(raw.cleaningPerWeek);
  if (perWeek !== undefined) out.cleaningPerWeek = perWeek;
  if (raw.cleaningMode === "daily" || raw.cleaningMode === "weekly") out.cleaningMode = raw.cleaningMode;

  if (Array.isArray(raw.rulesRows)) {
    out.rulesRows = raw.rulesRows
      .filter(isRecord)
      .slice(0, MAX_RULE_ITEMS)
      .map((r) => ({ lead: str(r.lead, 100) ?? "", title: str(r.title, 200) ?? "", detail: str(r.detail, 500) ?? "" }));
  }
  if (typeof raw.rulesDirty === "boolean") out.rulesDirty = raw.rulesDirty;

  if (Array.isArray(raw.newCustomItems)) {
    out.newCustomItems = raw.newCustomItems
      .filter(isRecord)
      .filter((i) => (i.kind === "service" || i.kind === "area") && typeof i.label === "string" && i.label.trim().length > 0)
      .slice(0, 10)
      .map((i) => ({ kind: i.kind as "service" | "area", label: (i.label as string).slice(0, 100) }));
  }
  if (Array.isArray(raw.faqItems)) {
    out.faqItems = raw.faqItems
      .filter(isRecord)
      .slice(0, 5)
      .map((f) => ({ question: str(f.question, 200) ?? "", answer: str(f.answer, 500) ?? "" }));
  }
  if (Array.isArray(raw.roomTypes)) out.roomTypes = raw.roomTypes.filter(isRecord).slice(0, 12);
  if (isRecord(raw.conditions)) out.conditions = raw.conditions;

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Nota que se agrega al aviso de salida cuando guardar tiene un efecto además de guardar. En una residencia ya publicada, fotos,
 * servicios, reglas, mínimo de estadía y estructura de habitaciones quedan pendientes de aprobación (docs/09 §8): nunca se guarda
 * en silencio al salir de la pantalla. Null = guardar solo guarda.
 */
export function saveImpactNote(status: string): string | null {
  if (status === "verified_active") {
    return "Tu residencia ya está publicada: si cambiaste fotos, servicios, reglas, mínimo de estadía o habitaciones, esos cambios quedan pendientes de aprobación del equipo de EstuRed.";
  }
  return null;
}
