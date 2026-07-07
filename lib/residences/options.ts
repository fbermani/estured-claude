import type { RoomTypeName } from "@/types/domain";

/**
 * Listas fijas del onboarding de residencias. Extraídas literalmente de
 * design-references/stitch_estured_mvp_2da parte/estured_configuraci_n_de_residencia_onboarding
 * (docs/06 §8.4 modela esto como jsonb libre; estas listas son la
 * convención de producto para no dejarlo en texto libre).
 *
 * Compartidas entre el formulario (cliente) y la validación server-side
 * — nunca confiar en lo que mande el formulario sin este whitelist.
 */
export const SERVICE_OPTIONS = [
  "Wifi Alta Velocidad",
  "Limpieza",
  "Seguridad 24/7",
  "Lavandería",
  "Cocina equipada",
  "Asistencia Médica",
  "Portero",
  "CCTV",
  "Acceso con Tarjeta",
  "Ropa de Cama",
  "Toallas",
  "Clases de Idiomas",
] as const;

export const COMMON_AREA_OPTIONS = [
  "Gimnasio",
  "Cocina",
  "Sala de estudio",
  "Terraza",
  "Coworking",
  "Salón de Juegos",
  "Sala de Cine",
  "Balcón",
] as const;

export const UNIVERSITY_OPTIONS = [
  "Universidad de Palermo (UP)",
  "Universidad Católica Argentina (UCA)",
  "UBA - Ciudad Universitaria",
  "Instituto Tecnológico de Buenos Aires (ITBA)",
  "UADE",
  "Universidad de Belgrano",
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  { value: "residencia_estudiantil", label: "Residencia Estudiantil" },
  { value: "departamento", label: "Departamento" },
  { value: "casa_compartida", label: "Casa Compartida" },
] as const;

export const ROOM_TYPE_NAMES: RoomTypeName[] = [
  "Individual",
  "Doble",
  "Triple",
  "Cuádruple",
  "Compartida",
];

export const GENDER_POLICY_OPTIONS = [
  { value: "mixto", label: "Mixto" },
  { value: "solo_hombres", label: "Solo Hombres" },
  { value: "solo_mujeres", label: "Solo Mujeres" },
] as const;

export const ADJUSTMENT_POLICY_OPTIONS = [
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
  { value: "none", label: "Sin ajuste" },
] as const;

export const ROOM_FEATURE_OPTIONS = ["Ventana", "Balcón", "Escritorio"] as const;

export const ZONE_OPTIONS = [
  "Palermo",
  "Recoleta",
  "Belgrano",
  "San Telmo",
  "Centro",
  "Caballito",
  "Almagro",
  "Núñez",
  "Villa Crespo",
  "Otra",
] as const;
