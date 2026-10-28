import { COMMON_AREA_OPTIONS, SERVICE_OPTIONS, serviceLabel } from "@/lib/residences/options";

/**
 * «Otro» en servicios y áreas comunes (DR18, fase 2). La residencia puede sumar un ítem propio junto a las opciones fijas: queda
 * pendiente y no se muestra en la ficha pública hasta que un admin de EstuRed lo aprueba. Puro y sin `server-only`: lo usan la
 * validación server-side, el formulario (solo para contadores) y los tests.
 */

export type CustomAmenityKind = "service" | "area";
export type CustomAmenityStatus = "pending" | "approved" | "rejected";

export const CUSTOM_AMENITY_KINDS: readonly CustomAmenityKind[] = ["service", "area"];
export const CUSTOM_AMENITY_MIN = 3;
export const CUSTOM_AMENITY_MAX = 40;
/** Tope de ítems pendientes de revisión por residencia (evita inundar la cola del admin). */
export const MAX_PENDING_CUSTOM_AMENITIES = 5;
/** Tope de ítems personalizados (cualquier estado) por tipo y residencia. */
export const MAX_CUSTOM_AMENITIES_PER_KIND = 6;
export const REJECT_REASON_MAX = 300;

export const KIND_LABELS: Record<CustomAmenityKind, string> = { service: "Servicio", area: "Área común" };

export type CustomAmenityRow = {
  id: string;
  residence_id: string;
  kind: CustomAmenityKind;
  label: string;
  status: CustomAmenityStatus;
  reject_reason: string | null;
  created_at: string;
};

/** Minúsculas, sin tildes ni signos, espacios colapsados: sirve para comparar duplicados. */
export function normalizeAmenityKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

// Palabras que el copy de EstuRed no usa (promesas, «oficial», «mediación»…): raíces para cubrir plurales y femeninos.
const FORBIDDEN_STEMS = ["respaldo", "garantia", "garantiz", "oficial", "asegurad", "mediacion", "validad", "certificad"];

const URL_RE = /(https?:|www\.|\b[a-z0-9-]+\.(com|ar|net|org|io|me|app|ly|co)\b|wa\.me|bit\.ly)/i;
const EMAIL_RE = /\S+@\S+|\bat\b\s*\S+\s*dot\b/i;
// Chat/contacto por fuera de la plataforma.
const CONTACT_WORDS_RE = /\b(whats\s?app|wsp|telegram|instagram|insta|facebook|tel[eé]fono|celular|llamame|escribime)\b/i;
const ALLOWED_CHARS_RE = /^[\p{L}\p{N} .,;:()/&+\-'’]+$/u;

export type CustomAmenityCheck = { ok: true; value: string } | { ok: false; error: string };

/** Texto del ítem «Otro»: corto, sin datos de contacto, sin enlaces, sin palabras del copy prohibido y sin repetir una opción fija. */
export function validateCustomAmenityLabel(raw: unknown, kind: CustomAmenityKind): CustomAmenityCheck {
  const value = String(raw ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (value.length < CUSTOM_AMENITY_MIN) return { ok: false, error: `Escribí al menos ${CUSTOM_AMENITY_MIN} letras para el ítem.` };
  if (value.length > CUSTOM_AMENITY_MAX) {
    return { ok: false, error: `«${value.slice(0, 20)}…» es muy largo: el máximo son ${CUSTOM_AMENITY_MAX} caracteres.` };
  }
  if (!ALLOWED_CHARS_RE.test(value)) {
    return { ok: false, error: `«${value}» tiene símbolos que no se pueden usar. Usá solo letras, números y signos simples.` };
  }
  if (!/\p{L}{2,}/u.test(value)) return { ok: false, error: `«${value}» tiene que incluir una palabra.` };
  if (URL_RE.test(value)) return { ok: false, error: "No se pueden incluir enlaces ni direcciones web en el ítem." };
  if (EMAIL_RE.test(value)) return { ok: false, error: "No se pueden incluir emails en el ítem." };
  if (/\d(?:[\s.\-()]*\d){5,}/.test(value)) return { ok: false, error: "No se pueden incluir teléfonos en el ítem." };
  if (CONTACT_WORDS_RE.test(value)) return { ok: false, error: "El ítem describe un servicio o un área: no incluyas datos de contacto." };
  const key = normalizeAmenityKey(value);
  if (FORBIDDEN_STEMS.some((stem) => key.includes(stem))) {
    return { ok: false, error: `«${value}» incluye una palabra que no podemos publicar. Describí el servicio o el área en términos simples.` };
  }
  const fixed = kind === "service" ? [...SERVICE_OPTIONS.flatMap((s) => [s, serviceLabel(s)])] : [...COMMON_AREA_OPTIONS];
  if (fixed.some((f) => normalizeAmenityKey(f) === key)) {
    return { ok: false, error: `«${value}» ya está entre las opciones de la lista: marcala ahí.` };
  }
  return { ok: true, value };
}

export type CustomAmenityDraft = { id?: string; kind: CustomAmenityKind; label: string };

/** Parsea el JSON del formulario (`custom_amenities_json`). `null` = formato inválido. Nunca confía en estado ni en residencia: solo kind/label/id. */
export function parseCustomAmenityDrafts(raw: string): CustomAmenityDraft[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 40) return null;
    const out: CustomAmenityDraft[] = [];
    for (const item of parsed) {
      const kind = item?.kind;
      if (kind !== "service" && kind !== "area") return null;
      const id = typeof item?.id === "string" && /^[0-9a-f-]{36}$/i.test(item.id) ? item.id : undefined;
      out.push({ id, kind, label: String(item?.label ?? "") });
    }
    return out;
  } catch {
    return null;
  }
}

export type CustomAmenityPlan = {
  /** Ítems nuevos o con texto cambiado (entran como pendientes). */
  toCreate: { kind: CustomAmenityKind; label: string }[];
  /** Ids existentes que ya no están (o cuyo texto cambió): se borran. */
  toDeleteIds: string[];
};

/**
 * Compara lo enviado con lo guardado y valida. Un ítem existente con el mismo texto y tipo no se toca (conserva su estado);
 * si cambió el texto, se borra y se crea uno nuevo pendiente (vuelve a revisión). Devuelve el error de la primera regla violada.
 */
export function planCustomAmenities(
  existing: Pick<CustomAmenityRow, "id" | "kind" | "label" | "status">[],
  drafts: CustomAmenityDraft[],
): { ok: true; plan: CustomAmenityPlan } | { ok: false; error: string } {
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const keep = new Set<string>();
  const toCreate: CustomAmenityPlan["toCreate"] = [];
  const seen = new Set<string>();
  for (const d of drafts) {
    if (!d.label.trim()) continue; // renglón vacío del formulario
    const prev = d.id ? existingById.get(d.id) : undefined;
    const sameAsPrev = prev && prev.kind === d.kind && normalizeAmenityKey(prev.label) === normalizeAmenityKey(d.label);
    const dupKey = `${d.kind}:${normalizeAmenityKey(d.label)}`;
    if (seen.has(dupKey)) return { ok: false, error: `«${d.label.trim()}» está repetido.` };
    seen.add(dupKey);
    if (sameAsPrev && prev) {
      keep.add(prev.id);
      continue;
    }
    const check = validateCustomAmenityLabel(d.label, d.kind);
    if (!check.ok) return { ok: false, error: check.error };
    toCreate.push({ kind: d.kind, label: check.value });
  }
  const toDeleteIds = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  const remaining = existing.filter((e) => keep.has(e.id));
  const pendingAfter = remaining.filter((e) => e.status === "pending").length + toCreate.length;
  if (pendingAfter > MAX_PENDING_CUSTOM_AMENITIES) {
    return { ok: false, error: `Tenés demasiados ítems pendientes de revisión (máximo ${MAX_PENDING_CUSTOM_AMENITIES}). Esperá a que el equipo de EstuRed los revise.` };
  }
  for (const kind of CUSTOM_AMENITY_KINDS) {
    const total = remaining.filter((e) => e.kind === kind).length + toCreate.filter((c) => c.kind === kind).length;
    if (total > MAX_CUSTOM_AMENITIES_PER_KIND) {
      return { ok: false, error: `Podés sumar hasta ${MAX_CUSTOM_AMENITIES_PER_KIND} ítems propios de ${kind === "service" ? "servicios" : "áreas comunes"}.` };
    }
  }
  return { ok: true, plan: { toCreate, toDeleteIds } };
}
