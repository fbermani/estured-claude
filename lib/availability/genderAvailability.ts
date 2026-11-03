import {
  ROOM_GENDERS,
  effectiveRoomGender,
  genderFromPolicy,
  isRoomGender,
  isSharedCapacity,
  policyFromGender,
  type RoomGender,
} from "@/lib/residences/roomGender";
import { typeAvailabilityState, type TypeAvailabilityState } from "@/lib/availability/typeAvailability";

/**
 * Disponibilidad por tipo + género (migración 0075). Lógica PURA, sin I/O ni `server-only`: la usan la pantalla de
 * Disponibilidad de la residencia (cliente y servidor), la ficha, el catálogo y los tests.
 *
 * Modelo: `profile_availability` sigue siendo UNA fila por tipo (el resumen que leen solicitudes, reservas, lista de espera y
 * jobs de vencimiento); `profile_availability_genders` guarda el detalle por género (una fila por tipo y género) y el servidor
 * recalcula el resumen del tipo cada vez que la residencia guarda (`rollupTypeAvailability`). El COPY visible de la disponibilidad
 * sigue viviendo solo en `components/ui/StatusTag.tsx`; acá solo se decide el estado.
 */

/** Estados que la residencia puede cargar en una fila de género (`not_updated` lo calcula el job; `paused_by_admin`, solo EstuRed). */
export const GENDER_ROW_STATUSES = ["available_to_confirm", "full", "paused_by_residence"] as const;
export type GenderRowStatus = (typeof GENDER_ROW_STATUSES)[number];

/** Etiquetas del formulario de la residencia (pantalla de gestión; no es el copy de disponibilidad de cara al estudiante). */
export const GENDER_ROW_STATUS_LABEL: Record<GenderRowStatus, string> = {
  available_to_confirm: "Disponible",
  full: "Completa",
  paused_by_residence: "Pausada",
};

export function isGenderRowStatus(value: unknown): value is GenderRowStatus {
  return typeof value === "string" && (GENDER_ROW_STATUSES as readonly string[]).includes(value);
}

export const MAX_GENDER_COUNT = 999;
export const MAX_GENDER_NOTE = 300;

/* ----------------------------- nombres ----------------------------- */

const ADJECTIVE: Record<RoomGender, [string, string]> = {
  masculino: ["masculina", "masculinas"],
  femenino: ["femenina", "femeninas"],
  mixto: ["mixta", "mixtas"],
  sin_especificar: ["sin género especificado", "sin género especificado"],
};

/** «masculina» / «masculinas»; «sin género especificado» para las que no tienen género. */
export function genderAdjective(gender: RoomGender, plural = false): string {
  return ADJECTIVE[gender][plural ? 1 : 0];
}

/** Plural de la primera palabra del nombre del tipo: «Doble» → «Dobles», «Individual» → «Individuales», «Doble con baño» → «Dobles con baño». */
export function pluralizeTypeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const [first, ...rest] = trimmed.split(/\s+/);
  const lower = first.toLowerCase();
  let plural: string;
  if (/s$/.test(lower)) plural = first;
  else if (/[aeiouáéíóú]$/.test(lower)) plural = `${first}s`;
  else if (/z$/.test(lower)) plural = `${first.slice(0, -1)}ces`;
  else plural = `${first}es`;
  return [plural, ...rest].join(" ");
}

/** Título de la fila en la pantalla de gestión: «Dobles masculinas». */
export function genderRowTitle(typeName: string, gender: RoomGender): string {
  return `${pluralizeTypeName(typeName)} ${genderAdjective(gender, true)}`;
}

/** Nombre de la oferta de cara al estudiante: «Doble femenina»; sin género, solo el tipo. */
export function genderOfferLabel(typeName: string, gender: RoomGender | null | undefined): string {
  if (!gender || gender === "sin_especificar") return typeName;
  return `${typeName} ${genderAdjective(gender)}`;
}

/** Igual que `genderOfferLabel`, desde el vocabulario de `gender_policy` («solo_mujeres» → «Doble femenina»). */
export function policyOfferLabel(typeName: string, policy: string | null | undefined): string {
  return genderOfferLabel(typeName, genderFromPolicy(policy));
}

/* ----------------------- habitaciones → sugerencia ----------------------- */

export type SuggestionRoom = {
  /** Género efectivo de la habitación (`effectiveRoomGender`). */
  gender: RoomGender;
  beds: { status: "active" | "out_of_service"; occupied: boolean }[];
};

export type GenderSummary = {
  gender: RoomGender;
  rooms: number;
  /** Camas activas (no cuenta las fuera de servicio). */
  beds: number;
  freeBeds: number;
  /** Habitaciones con al menos una cama activa y TODAS sus camas activas libres. */
  freeRooms: number;
  outOfServiceBeds: number;
};

/** Cuenta camas y habitaciones libres por género (ordenado como `ROOM_GENDERS`; solo los géneros que tienen habitaciones). */
export function summarizeRoomsByGender(rooms: readonly SuggestionRoom[]): GenderSummary[] {
  const byGender = new Map<RoomGender, GenderSummary>();
  for (const room of rooms) {
    const entry =
      byGender.get(room.gender) ?? { gender: room.gender, rooms: 0, beds: 0, freeBeds: 0, freeRooms: 0, outOfServiceBeds: 0 };
    const active = room.beds.filter((b) => b.status === "active");
    const free = active.filter((b) => !b.occupied).length;
    entry.rooms += 1;
    entry.beds += active.length;
    entry.freeBeds += free;
    entry.outOfServiceBeds += room.beds.length - active.length;
    if (active.length > 0 && free === active.length) entry.freeRooms += 1;
    byGender.set(room.gender, entry);
  }
  return ROOM_GENDERS.filter((g) => byGender.has(g)).map((g) => byGender.get(g)!);
}

/**
 * Géneros que pueden tener una fila de disponibilidad en un tipo: los de sus habitaciones. Sin habitaciones cargadas se ofrece el género
 * del tipo (o «mixta» si es compartido; «sin género» si es individual sin política), para que la residencia no quede sin poder publicar.
 */
export function candidateGenders(
  roomGenders: readonly RoomGender[],
  type: { policy: string | null | undefined; capacityPerRoom: number | null | undefined },
): RoomGender[] {
  if (roomGenders.length > 0) return ROOM_GENDERS.filter((g) => roomGenders.includes(g));
  const fromPolicy = genderFromPolicy(type.policy);
  if (fromPolicy) return [fromPolicy];
  return [isSharedCapacity(type.capacityPerRoom) ? "mixto" : "sin_especificar"];
}

/** Género efectivo de cada habitación de un tipo (mismo criterio que la ficha y la pantalla de Habitaciones). */
export function roomGendersOfType(
  rooms: readonly { gender?: string | null }[],
  type: { policy: string | null | undefined; capacityPerRoom: number | null | undefined },
): RoomGender[] {
  return rooms.map((r) => effectiveRoomGender({ roomGender: r.gender, typePolicy: type.policy, capacityPerRoom: type.capacityPerRoom }));
}

/* ------------------------------ filas ------------------------------ */

export type GenderRow = {
  gender: RoomGender;
  status: GenderRowStatus;
  availableCount: number | null;
  availableFrom: string | null;
  notesPublic: string | null;
};

/** Valor inicial sugerido para una fila sin datos guardados: camas libres del género; sin camas libres, «completa». */
export function suggestedRow(gender: RoomGender, summary: GenderSummary | undefined): GenderRow {
  const free = summary?.freeBeds ?? 0;
  return {
    gender,
    status: free > 0 ? "available_to_confirm" : "full",
    availableCount: free,
    availableFrom: null,
    notesPublic: null,
  };
}

export type EditorRow = {
  gender: RoomGender;
  /** Hay una fila guardada para este género. */
  stored: boolean;
  /** Fila guardada de un género que ya no tiene habitaciones en el tipo: se quita al guardar. */
  obsolete: boolean;
  summary: GenderSummary | null;
  /** Lo que se muestra en el formulario: lo guardado, o la sugerencia si todavía no hay nada guardado. */
  draft: GenderRow;
  /** Camas libres hoy, para ofrecer «Usar N». */
  suggestedCount: number;
};

/** Arma las filas del formulario de un tipo: una por género candidato (guardada o sugerida) + las obsoletas, al final. */
export function buildEditorRows(params: {
  candidates: readonly RoomGender[];
  stored: readonly GenderRow[];
  summaries: readonly GenderSummary[];
}): EditorRow[] {
  const storedBy = new Map(params.stored.map((r) => [r.gender, r]));
  const summaryBy = new Map(params.summaries.map((s) => [s.gender, s]));
  const rows: EditorRow[] = params.candidates.map((gender) => {
    const saved = storedBy.get(gender);
    const summary = summaryBy.get(gender) ?? null;
    return {
      gender,
      stored: !!saved,
      obsolete: false,
      summary,
      draft: saved ?? suggestedRow(gender, summary ?? undefined),
      suggestedCount: summary?.freeBeds ?? 0,
    };
  });
  for (const saved of params.stored) {
    if (params.candidates.includes(saved.gender)) continue;
    rows.push({ gender: saved.gender, stored: true, obsolete: true, summary: null, draft: saved, suggestedCount: 0 });
  }
  return rows;
}

/* ---------------------------- validación ---------------------------- */

export type GenderRowRaw = { status: unknown; count: unknown; from: unknown; note: unknown };

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Validación server-side de una fila enviada por el formulario. Devuelve un error accionable y en español. */
export function parseGenderRow(
  gender: RoomGender,
  raw: GenderRowRaw,
  label: string,
): { ok: true; row: GenderRow } | { ok: false; error: string } {
  if (!isGenderRowStatus(raw.status)) return { ok: false, error: `${label}: elegí un estado válido.` };
  const status = raw.status;

  const countText = String(raw.count ?? "").trim();
  let availableCount: number | null = null;
  if (countText !== "") {
    if (!/^\d{1,4}$/.test(countText)) return { ok: false, error: `${label}: la cantidad tiene que ser un número entero, 0 o más.` };
    availableCount = Number(countText);
    if (availableCount > MAX_GENDER_COUNT) return { ok: false, error: `${label}: la cantidad no puede pasar de ${MAX_GENDER_COUNT}.` };
  }
  if (status === "available_to_confirm" && availableCount === 0) {
    return { ok: false, error: `${label}: si no queda lugar, marcala como completa.` };
  }
  if (status === "full") availableCount = 0;

  const fromText = String(raw.from ?? "").trim();
  if (fromText !== "" && !isRealDate(fromText)) return { ok: false, error: `${label}: la fecha «disponible desde» no es válida.` };

  const note = String(raw.note ?? "").trim();
  if (note.length > MAX_GENDER_NOTE) return { ok: false, error: `${label}: la nota pública puede tener hasta ${MAX_GENDER_NOTE} caracteres.` };

  return { ok: true, row: { gender, status, availableCount, availableFrom: fromText || null, notesPublic: note || null } };
}

/* ------------------------ resumen del tipo ------------------------ */

export type TypeRollup = {
  status: "available_to_confirm" | "full" | "paused_by_residence";
  availableCount: number | null;
  availableFrom: string | null;
};

/**
 * Resumen que se guarda en `profile_availability` (el que leen el resto de los flujos):
 *  - algún género disponible → «disponible»; cantidad = suma si TODAS las filas disponibles la informaron (si no, null);
 *    «desde» = la más temprana, y null si alguna ya está disponible hoy;
 *  - ninguno disponible y todos completos (o completos y pausados) → «completa», cantidad 0;
 *  - todos pausados → «pausada por la residencia».
 * Sin filas devuelve null: no hay nada que resumir (no se toca el tipo).
 */
export function rollupTypeAvailability(rows: readonly Pick<GenderRow, "status" | "availableCount" | "availableFrom">[]): TypeRollup | null {
  if (rows.length === 0) return null;
  const available = rows.filter((r) => r.status === "available_to_confirm");
  if (available.length > 0) {
    const countKnown = available.every((r) => r.availableCount != null);
    const count = countKnown ? available.reduce((sum, r) => sum + (r.availableCount ?? 0), 0) : null;
    const froms = available.map((r) => r.availableFrom);
    const from = froms.some((f) => !f) ? null : ([...(froms as string[])].sort()[0] ?? null);
    return { status: "available_to_confirm", availableCount: count, availableFrom: from };
  }
  if (rows.every((r) => r.status === "paused_by_residence")) {
    return { status: "paused_by_residence", availableCount: null, availableFrom: null };
  }
  return { status: "full", availableCount: 0, availableFrom: null };
}

/**
 * ¿El total del tipo se movió desde la última carga por género? Pasa cuando una reserva confirmada o la salida de un residente ajustan el
 * contador del tipo (no saben el género). Solo se puede comparar si el tipo y todas las filas disponibles informan cantidad.
 */
export function typeCountDrifted(
  typeStatus: string | null | undefined,
  typeCount: number | null | undefined,
  rows: readonly Pick<GenderRow, "status" | "availableCount">[],
): boolean {
  if (rows.length === 0 || typeCount == null) return false;
  if (typeStatus !== "available_to_confirm" && typeStatus !== "full") return false;
  const rolled = rollupTypeAvailability(rows.map((r) => ({ ...r, availableFrom: null })));
  if (!rolled || rolled.availableCount == null) return false;
  return typeCount !== rolled.availableCount;
}

/* ------------------------- cara al estudiante ------------------------- */

/**
 * Estado efectivo de una fila de género. Manda lo más restrictivo: si el TIPO no está disponible (completo, pausado por la residencia o por
 * EstuRed, o sin actualizar) esa es la verdad para todos los géneros; si el tipo está disponible, cada género muestra el suyo.
 */
export function effectiveGenderState(typeStatus: string | null | undefined, genderStatus: string | null | undefined): TypeAvailabilityState {
  const typeState = typeAvailabilityState(typeStatus);
  if (typeState !== "available") return typeState;
  return typeAvailabilityState(genderStatus);
}

export type GenderOffer = {
  gender: RoomGender;
  state: TypeAvailabilityState;
  availableFrom: string | null;
  note: string | null;
};

/** Ofertas por género de un tipo para la ficha y la búsqueda (vacío si el tipo todavía no tiene detalle por género). */
export function genderOffers(
  typeStatus: string | null | undefined,
  rows: readonly { gender: string; status: string; availableFrom?: string | null; notesPublic?: string | null }[],
): GenderOffer[] {
  return rows
    .filter((r): r is typeof r & { gender: RoomGender } => isRoomGender(r.gender))
    .sort((a, b) => ROOM_GENDERS.indexOf(a.gender) - ROOM_GENDERS.indexOf(b.gender))
    .map((r) => ({
      gender: r.gender,
      state: effectiveGenderState(typeStatus, r.status),
      availableFrom: r.availableFrom ?? null,
      note: r.notesPublic?.trim() || null,
    }));
}

/** Política de género (vocabulario de `gender_policy`) de las ofertas de un tipo; las «sin género» no aportan. */
export function offerPolicies(offers: readonly Pick<GenderOffer, "gender">[]): ("mixto" | "solo_mujeres" | "solo_hombres")[] {
  const out: ("mixto" | "solo_mujeres" | "solo_hombres")[] = [];
  for (const o of offers) {
    const policy = policyFromGender(o.gender);
    if (policy && !out.includes(policy as never)) out.push(policy as never);
  }
  return out;
}
