/**
 * Resuelve ícono + descripción corta para un servicio/área común por
 * palabra clave, no por match exacto — cubre tanto los valores ya
 * guardados hoy (`SERVICE_OPTIONS`/`COMMON_AREA_OPTIONS` en
 * lib/residences/options.ts) como nombres equivalentes que una
 * residencia pueda haber escrito distinto. Evita que un ícono
 * "desaparezca" si el texto exacto no calza letra por letra.
 */
type AmenityMeta = { icon: string; description: string };

const SERVICE_RULES: { keywords: string[]; icon: string; description: string }[] = [
  { keywords: ["wifi", "internet"], icon: "wifi", description: "Conexión a internet en toda la residencia." },
  { keywords: ["cámara", "camara", "cctv"], icon: "videocam", description: "Monitoreo por cámaras las 24 horas." },
  { keywords: ["cocina"], icon: "kitchen", description: "Cocina equipada disponible para residentes." },
  { keywords: ["gimnasio", "gym"], icon: "fitness_center", description: "Gimnasio disponible dentro de la residencia." },
  { keywords: ["limpieza de habitaci", "limpieza en habitaci"], icon: "cleaning_services", description: "Limpieza periódica dentro de tu habitación." },
  { keywords: ["limpieza"], icon: "mop", description: "Limpieza de áreas comunes." },
  { keywords: ["lavandería", "lavanderia", "lavado"], icon: "local_laundry_service", description: "Servicio de lavandería disponible." },
  { keywords: ["seguridad"], icon: "security", description: "Seguridad en la residencia las 24 horas." },
  { keywords: ["aire acondicionado", "climatización", "climatizacion"], icon: "ac_unit", description: "Aire acondicionado en la residencia." },
  { keywords: ["área protegida", "area protegida", "acceso con tarjeta"], icon: "shield", description: "Acceso controlado y área protegida." },
  { keywords: ["coordinador", "portero", "encargado"], icon: "support_agent", description: "Alguien presencial para consultas del día a día." },
  { keywords: ["locker", "casillero"], icon: "lock", description: "Locker individual para guardar tus pertenencias." },
  { keywords: ["parrilla", "asado"], icon: "outdoor_grill", description: "Parrilla disponible para uso de residentes." },
  { keywords: ["dispenser", "agua"], icon: "water_drop", description: "Dispenser de agua disponible." },
  { keywords: ["ropa de cama", "sábana", "sabana"], icon: "bed", description: "Ropa de cama incluida." },
  { keywords: ["toalla"], icon: "dry_cleaning", description: "Toallas incluidas." },
  { keywords: ["idioma"], icon: "translate", description: "Clases de idiomas disponibles para residentes." },
  { keywords: ["médic", "medic", "asistencia"], icon: "medical_services", description: "Asistencia médica disponible." },
];

const COMMON_AREA_RULES: { keywords: string[]; icon: string; description: string }[] = [
  { keywords: ["sala de estar", "living", "estar"], icon: "weekend", description: "Espacio compartido para relajarte con otros residentes." },
  { keywords: ["sala de estudio", "área de estudio", "area de estudio", "estudio", "coworking"], icon: "school", description: "Espacio tranquilo para estudiar." },
  { keywords: ["comedor"], icon: "dining", description: "Comedor compartido." },
  { keywords: ["patio"], icon: "yard", description: "Patio de uso compartido." },
  { keywords: ["terraza"], icon: "deck", description: "Terraza de uso compartido." },
  { keywords: ["sala de juegos", "salón de juegos", "salon de juegos"], icon: "sports_esports", description: "Espacio de juegos y esparcimiento." },
  { keywords: ["cine"], icon: "theaters", description: "Sala de cine para residentes." },
  { keywords: ["balcón", "balcon"], icon: "balcony", description: "Balcón de uso compartido." },
  { keywords: ["gimnasio", "gym"], icon: "fitness_center", description: "Gimnasio disponible dentro de la residencia." },
  { keywords: ["cocina"], icon: "kitchen", description: "Cocina equipada disponible para residentes." },
];

function resolve(name: string, rules: { keywords: string[]; icon: string; description: string }[], fallbackIcon: string): AmenityMeta {
  const normalized = name.toLowerCase();
  const match = rules.find((r) => r.keywords.some((k) => normalized.includes(k)));
  return match ? { icon: match.icon, description: match.description } : { icon: fallbackIcon, description: name };
}

export function getServiceIcon(name: string): AmenityMeta {
  return resolve(name, SERVICE_RULES, "check_circle");
}

export function getCommonAreaIcon(name: string): AmenityMeta {
  return resolve(name, COMMON_AREA_RULES, "chair");
}
