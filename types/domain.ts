/**
 * Modelos conceptuales del dominio EstuRed — ciclo fundacional.
 *
 * Subconjunto de lectura pública del modelo completo definido en
 * docs/06_DATA_MODEL.md y docs/04_STATE_MACHINES.md. Los estados usan
 * los nombres oficiales de esos documentos; no inventar strings libres.
 *
 * En próximos ciclos estos tipos se reemplazan/derivan de los tipos
 * generados desde Supabase.
 */

/** Modo de residencia según el modelo freemium (docs/00 §6). */
export type ResidenceMode = "perfil_verificado" | "gestion_operativa";

/** Estado de verificación (subconjunto público de docs/04). */
export type VerificationStatus = "verified_active" | "pending_verification";

/**
 * Modo de comunicación de disponibilidad (docs/00 §8, docs/08 §4.5).
 * - real_by_place: Gestión Operativa — "Disponibilidad asegurada".
 * - by_room_type_to_confirm: Perfil Verificado — "Disponibilidad informada".
 * - full: residencia completa — habilita lista de espera.
 * - not_updated: sin actualización — consulta / lista de espera.
 */
export type AvailabilityMode =
  | "real_by_place"
  | "by_room_type_to_confirm"
  | "full"
  | "not_updated";

export type RoomTypeName =
  | "Individual"
  | "Doble"
  | "Triple"
  | "Cuádruple"
  | "Compartida";

export interface RoomTypeOffer {
  type: RoomTypeName;
  priceUsd: number;
  available: boolean;
}

export interface Residence {
  slug: string;
  name: string;
  zone: string; // barrio de CABA
  city: "CABA";
  mode: ResidenceMode;
  verificationStatus: VerificationStatus;
  availabilityMode: AvailabilityMode;
  published: boolean;
  priceFromUsd: number;
  matriculaUsd: number | null;
  depositoUsd: number | null;
  roomTypes: RoomTypeOffer[];
  services: string[];
  highlightedRules: string[];
  /**
   * Universidades cercanas — eje de comunicación confirmado por el dueño
   * (ciclo 2). Solo copy/mock por ahora; el filtro por universidad no es
   * parte del MVP (docs/08 §4.4 filtra por zona/barrio).
   */
  nearUniversities: string[];
  idealFor: string;
  description: string;
  photos: string[]; // URLs placeholder en el ciclo fundacional
  hasWaitlist: boolean;
}
