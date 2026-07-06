import type { Residence } from "@/types/domain";

/**
 * Residencias mock del ciclo fundacional.
 *
 * Basadas en las 6 residencias demo obligatorias de
 * docs/17_SEED_DATA_AND_DEMO_SCENARIOS.md, con contenido editorial
 * ampliado para poder visualizar catálogo y ficha. Datos ficticios;
 * ninguna persona ni residencia real.
 */
export const residences: Residence[] = [
  {
    slug: "residencia-norte",
    name: "Residencia Norte",
    zone: "Palermo",
    city: "CABA",
    mode: "gestion_operativa",
    verificationStatus: "verified_active",
    availabilityMode: "real_by_place",
    published: true,
    priceFromUsd: 300,
    matriculaUsd: 100,
    depositoUsd: 350,
    roomTypes: [
      { type: "Individual", priceUsd: 500, available: true },
      { type: "Doble", priceUsd: 350, available: true },
      { type: "Triple", priceUsd: 300, available: false },
    ],
    services: [
      "WiFi de alta velocidad",
      "Limpieza semanal de áreas comunes",
      "Cocina equipada",
      "Lavadero",
      "Sala de estudio",
      "Expensas y servicios incluidos",
    ],
    highlightedRules: [
      "Horario de silencio de 23:00 a 8:00",
      "No se permiten visitas con pernocte",
      "Espacios comunes compartidos con cuidado",
    ],
    nearUniversities: ["Universidad de Palermo", "UBA Derecho"],
    idealFor:
      "Estudiantes que buscan una residencia consolidada en Palermo, cerca de universidades y con gestión profesional.",
    description:
      "Residencia mixta en el corazón de Palermo, a pocas cuadras del subte y de líneas de colectivo directas a las principales universidades. Gestión profesional con disponibilidad actualizada en tiempo real, áreas comunes amplias y una comunidad activa de estudiantes del interior y del exterior.",
    photos: [
      "https://picsum.photos/seed/estured-norte-1/960/640",
      "https://picsum.photos/seed/estured-norte-2/960/640",
      "https://picsum.photos/seed/estured-norte-3/960/640",
    ],
    hasWaitlist: false,
  },
  {
    slug: "casa-universitaria-sur",
    name: "Casa Universitaria Sur",
    zone: "San Telmo",
    city: "CABA",
    mode: "perfil_verificado",
    verificationStatus: "verified_active",
    availabilityMode: "by_room_type_to_confirm",
    published: true,
    priceFromUsd: 250,
    matriculaUsd: 75,
    depositoUsd: 250,
    roomTypes: [
      { type: "Doble", priceUsd: 300, available: true },
      { type: "Triple", priceUsd: 250, available: true },
    ],
    services: [
      "WiFi",
      "Cocina compartida",
      "Patio interno",
      "Ropa de cama incluida",
      "Servicios incluidos",
    ],
    highlightedRules: [
      "Convivencia respetuosa en espacios comunes",
      "Registro de invitados en recepción",
    ],
    nearUniversities: ["UADE", "UCA Puerto Madero"],
    idealFor:
      "Estudiantes que priorizan presupuesto y quieren vivir en un barrio con historia, bien conectado con el centro.",
    description:
      "Casona reciclada en San Telmo con ambientes luminosos y ambiente familiar. La residencia informa su disponibilidad por tipo de habitación y confirma cada solicitud de forma manual, con respuesta rápida.",
    photos: [
      "https://picsum.photos/seed/estured-sur-1/960/640",
      "https://picsum.photos/seed/estured-sur-2/960/640",
      "https://picsum.photos/seed/estured-sur-3/960/640",
    ],
    hasWaitlist: false,
  },
  {
    slug: "residencia-obelisco",
    name: "Residencia Obelisco",
    zone: "Centro",
    city: "CABA",
    mode: "perfil_verificado",
    verificationStatus: "verified_active",
    availabilityMode: "full",
    published: true,
    priceFromUsd: 280,
    matriculaUsd: 80,
    depositoUsd: 280,
    roomTypes: [
      { type: "Doble", priceUsd: 320, available: false },
      { type: "Compartida", priceUsd: 280, available: false },
    ],
    services: [
      "WiFi",
      "Desayuno incluido",
      "Limpieza de habitaciones",
      "Seguridad 24 hs",
    ],
    highlightedRules: [
      "Check-in coordinado con la administración",
      "Horario de silencio nocturno",
    ],
    nearUniversities: ["UBA sedes céntricas", "UADE"],
    idealFor:
      "Estudiantes que quieren vivir a metros de todo: transporte, facultades del centro y vida urbana.",
    description:
      "Residencia céntrica con alta demanda durante todo el año. Actualmente completa: podés sumarte a la lista de espera y recibir aviso cuando se libere una plaza del tipo de habitación que te interesa.",
    photos: [
      "https://picsum.photos/seed/estured-obelisco-1/960/640",
      "https://picsum.photos/seed/estured-obelisco-2/960/640",
    ],
    hasWaitlist: true,
  },
  {
    slug: "residencia-rio-de-la-plata",
    name: "Residencia Río de la Plata",
    zone: "Belgrano",
    city: "CABA",
    mode: "gestion_operativa",
    verificationStatus: "verified_active",
    availabilityMode: "real_by_place",
    published: true,
    priceFromUsd: 320,
    matriculaUsd: 100,
    depositoUsd: 320,
    roomTypes: [
      { type: "Individual", priceUsd: 480, available: true },
      { type: "Doble", priceUsd: 360, available: true },
      { type: "Cuádruple", priceUsd: 320, available: true },
    ],
    services: [
      "WiFi de alta velocidad",
      "Gimnasio en el edificio",
      "Sala de estudio 24 hs",
      "Cocina por piso",
      "Bicicletero",
    ],
    highlightedRules: [
      "Uso de sala de estudio con reserva",
      "Convivencia con acuerdos por piso",
    ],
    nearUniversities: ["Universidad de Belgrano", "UTDT"],
    idealFor:
      "Estudiantes de universidades de zona norte que buscan comodidades modernas y disponibilidad confirmada.",
    description:
      "Edificio moderno en Belgrano con plazas gestionadas en tiempo real. Métricas de respuesta destacadas: la administración responde la mayoría de las solicitudes en menos de 24 horas.",
    photos: [
      "https://picsum.photos/seed/estured-rio-1/960/640",
      "https://picsum.photos/seed/estured-rio-2/960/640",
      "https://picsum.photos/seed/estured-rio-3/960/640",
    ],
    hasWaitlist: false,
  },
  {
    slug: "residencia-pendiente",
    name: "Residencia Pendiente",
    zone: "Caballito",
    city: "CABA",
    mode: "perfil_verificado",
    verificationStatus: "pending_verification",
    availabilityMode: "not_updated",
    published: false,
    priceFromUsd: 260,
    matriculaUsd: null,
    depositoUsd: null,
    roomTypes: [{ type: "Doble", priceUsd: 260, available: false }],
    services: ["WiFi", "Cocina compartida"],
    highlightedRules: [],
    nearUniversities: [],
    idealFor: "",
    description:
      "Residencia en proceso de verificación presencial por el equipo de EstuRed. No visible en el catálogo público.",
    photos: ["https://picsum.photos/seed/estured-pendiente-1/960/640"],
    hasWaitlist: false,
  },
  {
    slug: "residencia-alertas",
    name: "Residencia del Parque",
    zone: "Almagro",
    city: "CABA",
    mode: "perfil_verificado",
    verificationStatus: "verified_active",
    availabilityMode: "not_updated",
    published: true,
    priceFromUsd: 240,
    matriculaUsd: 60,
    depositoUsd: 240,
    roomTypes: [
      { type: "Triple", priceUsd: 240, available: false },
      { type: "Compartida", priceUsd: 220, available: false },
    ],
    services: ["WiFi", "Cocina compartida", "Terraza"],
    highlightedRules: ["Convivencia respetuosa", "Limpieza compartida por turnos"],
    nearUniversities: ["UTN Medrano", "UBA Económicas"],
    idealFor:
      "Estudiantes con presupuesto ajustado que valoran un barrio tranquilo y bien conectado.",
    description:
      "Residencia económica en Almagro. La disponibilidad no fue actualizada recientemente: podés consultar o sumarte a la lista de espera para recibir novedades.",
    photos: [
      "https://picsum.photos/seed/estured-parque-1/960/640",
      "https://picsum.photos/seed/estured-parque-2/960/640",
    ],
    hasWaitlist: true,
  },
];

/** Residencias visibles en el catálogo público. */
export function getPublishedResidences(): Residence[] {
  return residences.filter((r) => r.published);
}

export function getResidenceBySlug(slug: string): Residence | undefined {
  return residences.find((r) => r.slug === slug && r.published);
}

export const zones = [...new Set(getPublishedResidences().map((r) => r.zone))];
