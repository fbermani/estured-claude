/**
 * División de funciones entre Perfil Verificado y Plan Premium (Gestión Operativa) — DR17 (docs/00 §31).
 * Fuente única para la landing /for-residences, la página de planes del panel y el remarcado Premium.
 * Es solo comunicación: ninguna función se bloquea (D8). Nomenclatura: DR23 (Plan Gratuito = Perfil Verificado; Plan Premium = Gestión Operativa).
 */
export type PlanFeature = { label: string; detail: string; icon: string };

export const VERIFIED_FEATURES: PlanFeature[] = [
  { label: "Perfil público verificado con fotos, servicios y reglas", detail: "Es lo primero que ve un estudiante al buscar — reduce las consultas de gente que no tenía la información básica.", icon: "verified" },
  { label: "Disponibilidad informada por tipo de habitación", detail: "Mostrás cupo por tipo de habitación sin necesidad de gestionar cada cama individualmente.", icon: "bed" },
  { label: "Solicitudes de reserva registradas", detail: "Cada solicitud queda con fecha y estado, sin depender de tu memoria o de un chat.", icon: "inbox" },
  { label: "Lista de espera", detail: "Cuando un tipo de habitación está completo, los interesados se anotan en tu lista. Si se libera un lugar, les avisás desde tu panel.", icon: "hourglass_top" },
  { label: "Preguntas frecuentes", detail: "Cargá hasta 5 preguntas y respuestas en tu ficha para que los interesados resuelvan dudas básicas antes de escribirte.", icon: "forum" },
  { label: "Reglamento", detail: "Publicá el reglamento de tu residencia para que cada estudiante lo conozca antes de enviar su solicitud de reserva.", icon: "gavel" },
  { label: "Soporte", detail: "Abrí un caso con EstuRed si algo no salió como esperabas con un estudiante o familiar.", icon: "support_agent" },
];

export const PREMIUM_FEATURES: PlanFeature[] = [
  { label: "Habitaciones y plazas", detail: "Cargás tus habitaciones y camas, y ves la ocupación de cada una.", icon: "meeting_room" },
  { label: "Residentes", detail: "Registrás altas, salidas y notas, y respondés los avisos de «Quiero cambiar».", icon: "groups" },
  { label: "Comunidad visible", detail: "Los estudiantes conocen a quienes viven en tu residencia.", icon: "diversity_3" },
  { label: "Elección de plaza", detail: "El estudiante puede indicar una plaza libre al enviar su solicitud de reserva; la residencia confirma.", icon: "bed" },
  { label: "Renovaciones", detail: "Gestioná renovaciones de tus residentes actuales sin tener que perseguir confirmaciones.", icon: "sync_alt" },
];

export const PLAN_PRICE_NOTE =
  "El plan todavía no tiene precio: te lo vamos a informar con anticipación y nadie paga nada sin aceptarlo antes.";
