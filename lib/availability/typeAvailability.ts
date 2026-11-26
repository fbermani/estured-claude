import type { AvailabilityMode } from "@/types/domain";

/**
 * Fuente ÚNICA de la disponibilidad que ve el estudiante (D3 / H03, Ciclo 55).
 *
 * Manda el TIPO de habitación (`profile_availability.status`). Las camas
 * libres calculadas desde `rooms`/`resident_stays` son información de
 * ocupación (comunidad, panel de la residencia): nunca deciden qué se le
 * ofrece al estudiante ni qué estado se le muestra.
 *
 * Módulo puro (sin `server-only`): lo usan el catálogo, la ficha, las
 * pantallas del estudiante y `CommunityBrowser` (cliente). El COPY visible
 * vive solo en `components/ui/StatusTag.tsx`; acá solo se decide el estado.
 */

/** Estado de disponibilidad de un tipo de habitación, ya normalizado. */
export type TypeAvailabilityState =
  | "available"
  | "full"
  | "not_updated"
  | "paused_by_residence"
  | "paused_by_admin";

/**
 * Normaliza el `profile_availability.status` crudo.
 * - `available_to_confirm` -> "available" (disponibilidad informada, a confirmar al solicitar).
 * - `full` -> "full".
 * - `paused_by_residence` / `paused_by_admin` -> estados propios: BLOQUEAN la solicitud (docs/04 §10.2).
 * - cualquier otro (`not_updated`, fila ausente) -> "not_updated": no se promete ni se niega lugar.
 */
export function typeAvailabilityState(status: string | null | undefined): TypeAvailabilityState {
  if (status === "available_to_confirm") return "available";
  if (status === "full") return "full";
  if (status === "paused_by_residence") return "paused_by_residence";
  if (status === "paused_by_admin") return "paused_by_admin";
  return "not_updated";
}

export function isTypePaused(state: TypeAvailabilityState): boolean {
  return state === "paused_by_residence" || state === "paused_by_admin";
}

/**
 * DR69: un tipo sin actualizar que ya salió de las búsquedas (`hidden_from_search_at`, día 45) no admite solicitudes.
 * La marca solo cuenta con "not_updated": al actualizar, la residencia la limpia.
 */
export function isStaleBlocked(state: TypeAvailabilityState, hiddenFromSearch = false): boolean {
  return state === "not_updated" && hiddenFromSearch;
}

/**
 * ¿Se puede enviar una solicitud (o propuesta) para este tipo? Lo bloquean `full`, las pausas
 * (de la residencia o de EstuRed) y el día 45 sin actualizar (DR69). Entre los días 30 y 45 se permite,
 * sujeta a confirmación de la residencia (docs/04 §10.4).
 */
export function isTypeRequestable(state: TypeAvailabilityState, hiddenFromSearch = false): boolean {
  return state !== "full" && !isTypePaused(state) && !isStaleBlocked(state, hiddenFromSearch);
}

/** Texto de la ficha cuando el día 45 bloquea (DR69). */
export const STALE_NOTICE = "La residencia no actualizó su disponibilidad. Por ahora no recibe solicitudes de reserva.";
/** Error por tipo de habitación cuando el día 45 bloquea (DR69). */
export const STALE_ROOM_MESSAGE = "La residencia no actualizó la disponibilidad de esta habitación. Probá otro tipo.";

/** Mensaje de error (server actions) cuando el tipo no admite solicitudes; `null` si se puede. */
export function requestBlockedMessage(state: TypeAvailabilityState, hiddenFromSearch = false): string | null {
  if (isStaleBlocked(state, hiddenFromSearch)) return STALE_ROOM_MESSAGE;
  if (state === "full") return "Esa habitación ya no tiene lugar. Probá otro tipo.";
  if (state === "paused_by_residence") return "La residencia pausó las solicitudes para este tipo de habitación. Probá otro tipo.";
  if (state === "paused_by_admin") return "La disponibilidad de este tipo de habitación está pausada por EstuRed. Probá otro tipo.";
  return null;
}

/**
 * ¿Se le ofrece al estudiante "Elegir este lugar" en un slot de cama libre?
 * Solo si el TIPO está disponible. El slot libre de un tipo completo o sin
 * actualizar es información, no una acción (D3).
 */
export function canOfferBedSelection(state: TypeAvailabilityState | null | undefined): boolean {
  return state === "available";
}

/** Mapea el estado de un tipo al modo que entiende `StatusTag`. */
export function typeAvailabilityMode(state: TypeAvailabilityState): AvailabilityMode {
  switch (state) {
    case "available":
      return "by_room_type_to_confirm";
    case "full":
      return "full";
    case "not_updated":
      return "not_updated";
    case "paused_by_residence":
      return "paused_by_residence";
    case "paused_by_admin":
      return "paused_by_admin";
  }
}

/**
 * Modo de disponibilidad de TODA la residencia (card del catálogo, filtros):
 * algún tipo disponible -> informada; todos completos -> completa; resto -> sin actualizar.
 */
export function residenceAvailabilityMode(states: readonly TypeAvailabilityState[]): AvailabilityMode {
  if (states.some((s) => s === "available")) return "by_room_type_to_confirm";
  if (states.length > 0 && states.every((s) => s === "full")) return "full";
  return "not_updated";
}

/** Pista de la card del catálogo cuando ningún tipo está disponible (K01). `null` = sin badge. */
export type CatalogAvailabilityHint = "waitlist" | "not_updated" | null;

/**
 * Qué badge muestra la card cuando NO hay tipos disponibles: algún tipo completo y ninguno pausado ->
 * "waitlist"; alguna pausa -> `null` (ya lo dice el StatusTag); resto -> "not_updated".
 */
export function catalogAvailabilityHint(states: readonly TypeAvailabilityState[]): CatalogAvailabilityHint {
  if (states.some(isTypePaused)) return null;
  if (states.some((s) => s === "full")) return "waitlist";
  return "not_updated";
}

/**
 * Precio "desde" (USD) para mostrar: el mínimo entre los tipos que admiten solicitud (ni completos ni
 * pausados); si ninguno la admite, el mínimo de todos. Ignora precios no positivos o no finitos, así que
 * nunca devuelve 0 ("Desde USD 0"): sin precios válidos devuelve `null` (quien llama oculta el "desde").
 */
export function startingPriceUsd(
  types: readonly { priceUsd: number; state: TypeAvailabilityState }[],
): number | null {
  const valid = types.filter((t) => Number.isFinite(t.priceUsd) && t.priceUsd > 0);
  if (valid.length === 0) return null;
  const requestable = valid.filter((t) => isTypeRequestable(t.state));
  const pool = requestable.length > 0 ? requestable : valid;
  return Math.min(...pool.map((t) => t.priceUsd));
}
