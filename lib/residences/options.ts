import type { RoomTypeName } from "@/types/domain";
import { UNIVERSITY_NAMES, UNIVERSITY_OTHER_NAME } from "@/lib/data/buenosAiresUniversities";
import { CABA_BARRIOS } from "@/lib/data/caBarrios";

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
  "Wifi",
  "Cámaras 24 hs",
  "Limpieza General",
  "Limpieza de Habitación",
  "Lavandería",
  "Área Protegida",
  "Coordinador Presencial",
  "Lockers Individuales",
  "Parrilla",
  "Dispenser de Agua",
] as const;

export const COMMON_AREA_OPTIONS = [
  "Sala de Estar",
  "Sala de Estudio",
  "Área de Estudio",
  "Comedor",
  "Patio",
  "Terraza",
  "Sala de Juegos",
  // 0073: «Gimnasio» (antes servicio) y «Cocina compartida» (antes servicio «Cocina», con cantidad de 1 a 5) viven en áreas comunes.
  "Gimnasio",
  "Cocina compartida",
] as const;

/**
 * Derivado de `lib/data/buenosAiresUniversities.ts` (fuente única con
 * coordenadas) — antes era una lista de 6 universidades sin coordenadas;
 * ahora comparte el mismo dataset que el mapa de la ficha y el filtro
 * de `/search`.
 */
export const UNIVERSITY_OPTIONS = [...UNIVERSITY_NAMES, UNIVERSITY_OTHER_NAME];

export const PROPERTY_TYPE_OPTIONS = [
  // Auditoría del Owner (DR18): por ahora solo «Residencia Estudiantil». Las filas viejas con otros valores no se tocan.
  { value: "residencia_estudiantil", label: "Residencia Estudiantil" },
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

export const ROOM_FEATURE_OPTIONS = ["Ventana", "Balcón", "Escritorio", "Velador", "Ropero individual"] as const;

/** «Barrio» (antes «Zona»): los 48 barrios oficiales de CABA, guardados en `residences.public_area`. */
export const BARRIO_OPTIONS = CABA_BARRIOS;

/**
 * Etiqueta a mostrar de un servicio guardado. El valor guardado NO cambia (datos existentes); solo el texto visible.
 * Auditoría del Owner (DR18): «Gimnasio / Área para ejercitar» y «Área Protegida (emergencias médicas)».
 */
const SERVICE_DISPLAY_LABELS: Record<string, string> = {
  Gimnasio: "Gimnasio / Área para ejercitar",
  "Área Protegida": "Área Protegida (emergencias médicas)",
};

export function serviceLabel(value: string): string {
  return SERVICE_DISPLAY_LABELS[value] ?? value;
}

/** Reglas de convivencia típicas, solo como sugerencia al elegir las 5 destacadas (DR18): la residencia las puede editar o escribir las suyas. */
export const RULE_SUGGESTIONS = [
  "Respetar los horarios de silencio",
  "Prohibido fumar en interiores",
  "Visitas con aviso previo",
  "Mantener limpios los espacios compartidos",
  "Cuidar las instalaciones y los muebles",
  "Avisar si te ausentás varios días",
  "Usar auriculares en espacios comunes",
  "Respetar las pertenencias de los demás",
] as const;
