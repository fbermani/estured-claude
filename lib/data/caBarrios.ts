/**
 * Los 48 barrios oficiales de la Ciudad Autónoma de Buenos Aires (auditoría del Owner, DR18).
 * Fuente única para el alta de residencias («Barrio») y su validación server-side. El dato se guarda en la columna
 * existente `residences.public_area`; las residencias previas con valores viejos («Centro», «Otra») conservan lo
 * guardado y siguen publicadas — la lista solo rige para altas nuevas.
 */
export const CABA_BARRIOS = [
  "Agronomía",
  "Almagro",
  "Balvanera",
  "Barracas",
  "Belgrano",
  "Boedo",
  "Caballito",
  "Chacarita",
  "Coghlan",
  "Colegiales",
  "Constitución",
  "Flores",
  "Floresta",
  "La Boca",
  "La Paternal",
  "Liniers",
  "Mataderos",
  "Monte Castro",
  "Montserrat",
  "Nueva Pompeya",
  "Núñez",
  "Palermo",
  "Parque Avellaneda",
  "Parque Chacabuco",
  "Parque Chas",
  "Parque Patricios",
  "Puerto Madero",
  "Recoleta",
  "Retiro",
  "Saavedra",
  "San Cristóbal",
  "San Nicolás",
  "San Telmo",
  "Vélez Sarsfield",
  "Versalles",
  "Villa Crespo",
  "Villa del Parque",
  "Villa Devoto",
  "Villa General Mitre",
  "Villa Lugano",
  "Villa Luro",
  "Villa Ortúzar",
  "Villa Pueyrredón",
  "Villa Real",
  "Villa Riachuelo",
  "Villa Santa Rita",
  "Villa Soldati",
  "Villa Urquiza",
] as const;

const BARRIO_SET = new Set<string>(CABA_BARRIOS);

/** `true` si el texto es exactamente uno de los 48 barrios oficiales. */
export function isCabaBarrio(value: unknown): value is (typeof CABA_BARRIOS)[number] {
  return typeof value === "string" && BARRIO_SET.has(value);
}
