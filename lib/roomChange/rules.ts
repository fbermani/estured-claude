/**
 * Cambio de habitación (DR34, migración 0076). Reglas PURAS: sin base de datos ni `server-only`, así las usan el servidor, la interfaz y los tests.
 *
 * Un pedido es de un residente que quiere otra habitación DENTRO de su residencia. Nunca es una solicitud, una renovación ni un «Quiero
 * cambiar» (cambio de residencia): es una entidad aparte y no cobra nada. Siempre sujeto a disponibilidad y a los costos que correspondan.
 */

export const ROOM_CHANGE_STATUSES = ["pending", "offered", "resolved", "cancelled"] as const;
export type RoomChangeStatus = (typeof ROOM_CHANGE_STATUSES)[number];

/** Estados abiertos: el pedido sigue vivo (cuenta para el filtro, los avisos y el índice único por estadía). */
export const ROOM_CHANGE_OPEN_STATUSES: readonly RoomChangeStatus[] = ["pending", "offered"];

export const ROOM_CHANGE_STATUS_LABEL: Record<RoomChangeStatus, string> = {
  pending: "Pendiente",
  offered: "En gestión",
  resolved: "Resuelta",
  cancelled: "Cancelada",
};

export const ROOM_CHANGE_ORIGINS = ["student", "residence"] as const;
export type RoomChangeOrigin = (typeof ROOM_CHANGE_ORIGINS)[number];

/** Género de habitación que se puede pedir (el pedido nunca pide «sin especificar»). */
export const ROOM_CHANGE_GENDERS = ["masculino", "femenino", "mixto"] as const;
export type RoomChangeGender = (typeof ROOM_CHANGE_GENDERS)[number];

export const ROOM_CHANGE_GENDER_LABEL: Record<RoomChangeGender, string> = {
  masculino: "Masculina",
  femenino: "Femenina",
  mixto: "Mixta",
};

export const ROOM_CHANGE_NOTE_MAX = 300;
export const ROOM_CHANGE_REASON_MAX = 500;

/**
 * Texto de costos que ve (y reconoce) el estudiante al pedir. Se guarda tal cual en el pedido como constancia. No promete disponibilidad ni
 * fija montos: la residencia informa y acuerda los costos; EstuRed no cobra nada por este pedido.
 */
export const ROOM_CHANGE_COSTS_NOTICE =
  "Entiendo que el cambio está sujeto a la disponibilidad de la residencia y que, si se concreta, asumo los costos que correspondan, que me informa y acuerda la residencia. EstuRed no cobra nada por este pedido.";

export function isRoomChangeStatus(value: unknown): value is RoomChangeStatus {
  return typeof value === "string" && (ROOM_CHANGE_STATUSES as readonly string[]).includes(value);
}

export function isRoomChangeGender(value: unknown): value is RoomChangeGender {
  return typeof value === "string" && (ROOM_CHANGE_GENDERS as readonly string[]).includes(value);
}

export function isOpenRoomChangeStatus(status: string): boolean {
  return (ROOM_CHANGE_OPEN_STATUSES as readonly string[]).includes(status);
}

/** Transiciones que puede hacer la RESIDENCIA sobre un pedido abierto (de pendiente a en gestión y de vuelta, o cerrarlo). */
export function canResidenceMoveRoomChange(from: RoomChangeStatus, to: RoomChangeStatus): boolean {
  if (from === "pending") return to === "offered" || to === "resolved" || to === "cancelled";
  if (from === "offered") return to === "pending" || to === "resolved" || to === "cancelled";
  return false;
}

/** El estudiante solo puede cancelar un pedido que sigue abierto. */
export function canStudentCancelRoomChange(status: RoomChangeStatus): boolean {
  return isOpenRoomChangeStatus(status);
}

export type RoomChangePreferenceInput = {
  roomTypeId: unknown;
  gender: unknown;
  note: unknown;
  reason: unknown;
};

export type RoomChangePreference = {
  roomTypeId: string | null;
  gender: RoomChangeGender | null;
  note: string | null;
  reason: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim() : "";
}

/**
 * Valida la preferencia. «Me da igual» = vacío (nulo). Hace falta al menos UNA preferencia (tipo, género o nota): un pedido sin ninguna no
 * dice qué se busca y avisaría por cualquier plaza que se libere. El tipo de habitación se verifica contra la residencia en el servidor.
 */
export function validateRoomChangePreference(input: RoomChangePreferenceInput): { ok: true; value: RoomChangePreference } | { ok: false; error: string } {
  const rawType = cleanText(input.roomTypeId);
  if (rawType && !UUID_RE.test(rawType)) return { ok: false, error: "Elegí un tipo de habitación válido." };
  const rawGender = cleanText(input.gender);
  if (rawGender && !isRoomChangeGender(rawGender)) return { ok: false, error: "Elegí un género válido para la habitación." };
  const note = cleanText(input.note);
  if (note.length > ROOM_CHANGE_NOTE_MAX) return { ok: false, error: `La nota puede tener hasta ${ROOM_CHANGE_NOTE_MAX} caracteres.` };
  const reason = cleanText(input.reason);
  if (reason.length > ROOM_CHANGE_REASON_MAX) return { ok: false, error: `El motivo puede tener hasta ${ROOM_CHANGE_REASON_MAX} caracteres.` };
  if (!rawType && !rawGender && !note) {
    return { ok: false, error: "Contanos qué buscás: un tipo de habitación, un género o una nota (por ejemplo, un piso más alto)." };
  }
  return {
    ok: true,
    value: {
      roomTypeId: rawType || null,
      gender: rawGender ? (rawGender as RoomChangeGender) : null,
      note: note || null,
      reason: reason || null,
    },
  };
}

export type PlaceForMatching = {
  roomTypeId: string | null;
  /** Género de la habitación de la plaza (`rooms.gender` efectivo); `null` o `sin_especificar` = desconocido. */
  gender: string | null;
};

export type RequestForMatching = {
  id: string;
  residentStayId: string;
  status: string;
  preferredRoomTypeId: string | null;
  preferredGender: string | null;
};

/**
 * ¿Esta plaza liberada coincide con el pedido? Solo los pedidos PENDIENTES (uno ya en gestión tiene a la residencia trabajando). Una
 * preferencia nula es «me da igual». Si la plaza no tiene género definido, solo coincide con quien no pidió un género (no se avisa por
 * una plaza que quizá no sirva). Una nota libre no se puede comparar sola: se trata como «me da igual» y la residencia la lee en el aviso.
 * Nunca coincide con el pedido de la misma estadía que dejó la plaza (`freedByStayId`).
 */
export function requestMatchesPlace(request: RequestForMatching, place: PlaceForMatching, freedByStayId?: string | null): boolean {
  if (request.status !== "pending") return false;
  if (freedByStayId && request.residentStayId === freedByStayId) return false;
  if (request.preferredRoomTypeId && request.preferredRoomTypeId !== place.roomTypeId) return false;
  if (request.preferredGender) {
    if (!place.gender || place.gender === "sin_especificar") return false;
    if (request.preferredGender !== place.gender) return false;
  }
  return true;
}

export function matchingRequestIds(requests: RequestForMatching[], place: PlaceForMatching, freedByStayId?: string | null): string[] {
  return requests.filter((r) => requestMatchesPlace(r, place, freedByStayId)).map((r) => r.id);
}

export const PLACE_ALERT_SOURCES = ["stay_ended", "bed_move", "bed_reactivated", "room_reactivated"] as const;
export type PlaceAlertSource = (typeof PLACE_ALERT_SOURCES)[number];

export const PLACE_ALERT_SOURCE_LABEL: Record<PlaceAlertSource, string> = {
  stay_ended: "Se liberó por la salida de un residente",
  bed_move: "Se liberó porque un residente cambió de cama",
  bed_reactivated: "La cama volvió a estar en servicio",
  room_reactivated: "La habitación volvió a estar en servicio",
};

export const PLACE_ALERT_STATUSES = ["pending", "offered", "published", "ignored", "resolved"] as const;
export type PlaceAlertStatus = (typeof PLACE_ALERT_STATUSES)[number];
export const PLACE_ALERT_OPEN_STATUSES: readonly PlaceAlertStatus[] = ["pending", "offered"];

export type PlaceAlertDecision = "offer" | "ignore" | "publish";

export function parsePlaceAlertDecision(value: unknown): PlaceAlertDecision | null {
  return value === "offer" || value === "ignore" || value === "publish" ? value : null;
}

/** Etiqueta corta de la preferencia de un pedido, para chips y el aviso («Doble · Femenina · 3.er piso»). */
export function describePreference(pref: { typeName: string | null; gender: string | null; note: string | null }): string {
  const parts: string[] = [];
  if (pref.typeName) parts.push(pref.typeName);
  if (pref.gender && isRoomChangeGender(pref.gender)) parts.push(ROOM_CHANGE_GENDER_LABEL[pref.gender]);
  if (pref.note) parts.push(pref.note);
  return parts.length ? parts.join(" · ") : "Sin preferencia";
}
