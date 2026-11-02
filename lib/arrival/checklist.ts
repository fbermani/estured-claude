/**
 * Catálogo del checklist de llegada (DR29, lote 2A). Estático y tipado: lo que se guarda en DB es solo `item_key` (estable).
 * Genérico a propósito: sin datos de trámites, horarios, teléfonos ni promesas de disponibilidad; donde un dato depende de la
 * residencia, de la universidad o del organismo, el ítem dice que hay que confirmarlo. El dueño lo irá puliendo.
 * Reglas: las `key` no se renombran nunca (los tildes guardados dependen de ellas); para retirar un ítem, quitarlo del catálogo.
 */

export type ChecklistItem = {
  key: string;
  label: string;
  hint?: string;
  /** Clave corta, id o slug de una guía (se resuelve con `resolveGuides`; si no existe, se omite). */
  guide?: string;
};

export type ChecklistCategory = {
  id: string;
  title: string;
  icon: string;
  items: ChecklistItem[];
};

export const ARRIVAL_CHECKLIST: ChecklistCategory[] = [
  {
    id: "documentacion",
    title: "Documentación",
    icon: "badge",
    items: [
      { key: "doc.identidad", label: "Documento de identidad o pasaporte vigente", hint: "Revisá la fecha de vencimiento y llevá también una copia.", guide: "02" },
      { key: "doc.constancia", label: "Constancia de inscripción en tu institución", hint: "Guardala impresa y en el celular." },
      { key: "doc.antecedentes", label: "Antecedentes académicos y lo que pida tu institución", hint: "No todas piden lo mismo: confirmalo con la tuya." },
      { key: "doc.migratorio", label: "Requisitos migratorios y de residencia, si venís del exterior", hint: "Varían según nacionalidad y situación: verificalos en los organismos oficiales." },
      { key: "doc.copias", label: "Copias de tus documentos, en papel y en la nube", hint: "Un respaldo digital te evita sustos si algo se pierde." },
      { key: "doc.comprobante", label: "Comprobante de tu reserva en EstuRed a mano", hint: "Lo encontrás en tu panel; guardalo también fuera de línea." },
      { key: "doc.contrato", label: "Contrato y reglamento de la residencia, leídos", hint: "Si algo no te queda claro, consultalo antes de viajar.", guide: "01" },
      { key: "doc.autorizaciones", label: "Autorizaciones o permisos, si sos menor de edad", hint: "Hablalo con tu familia y con la residencia." },
    ],
  },
  {
    id: "dinero",
    title: "Dinero y pagos",
    icon: "payments",
    items: [
      { key: "dinero.presupuesto", label: "Presupuesto del primer mes armado", hint: "Separá gastos únicos de recurrentes y sumá un margen para imprevistos.", guide: "02" },
      { key: "dinero.pagos-residencia", label: "Tengo claro qué le pago a la residencia, cuánto y cuándo", hint: "Revisá tu contrato y tu comprobante." },
      { key: "dinero.medios", label: "Medios de pago listos para los primeros días", hint: "Efectivo, tarjeta o transferencia: confirmá qué te sirve en tu caso." },
      { key: "dinero.banco", label: "Avisé a mi banco o tarjeta que voy a estar en otra ciudad o país", hint: "Evita bloqueos por consumos desconocidos." },
      { key: "dinero.reserva-emergencia", label: "Reservé un monto para imprevistos", hint: "Algo que puedas usar sin depender de nadie el primer mes." },
      { key: "dinero.comprobantes", label: "Guardé los comprobantes de pagos ya hechos", hint: "Cuentan para cualquier consulta posterior." },
    ],
  },
  {
    id: "residencia",
    title: "Con la residencia",
    icon: "apartment",
    items: [
      { key: "res.direccion", label: "Dirección exacta de la residencia guardada en el celular", hint: "Fijate también cómo llegar en transporte." },
      { key: "res.fecha-hora", label: "Fecha y horario de ingreso confirmados con la residencia", hint: "Escribile y pedí confirmación por escrito." },
      { key: "res.contacto", label: "Persona de contacto para el día de la llegada", hint: "Nombre y un medio de contacto que puedas usar al llegar." },
      { key: "res.habitacion", label: "Revisé qué habitación o plaza figura en mi solicitud" },
      { key: "res.llevar", label: "Pregunté qué tengo que llevar", hint: "Ropa de cama, toallas, utensilios o candado pueden estar incluidos o no." },
      { key: "res.reglas", label: "Conozco las normas de convivencia, visitas y espacios comunes", guide: "04" },
      { key: "res.ingreso-egreso", label: "Entiendo el proceso de ingreso y de egreso", hint: "Y qué pasa si cambian mis planes." },
    ],
  },
  {
    id: "viaje",
    title: "Viaje y traslado",
    icon: "flight_takeoff",
    items: [
      { key: "viaje.pasajes", label: "Pasajes comprados con margen antes del inicio de clases", hint: "Llegar dos o tres semanas antes ayuda a adaptarte, si tus posibilidades lo permiten.", guide: "02" },
      { key: "viaje.traslado", label: "Resolví cómo ir de la terminal o el aeropuerto a la residencia", hint: "Taxi, remís, aplicaciones o transporte público: elegí con anticipación." },
      { key: "viaje.horario-llegada", label: "Compartí mi horario de llegada con la residencia y mi familia" },
      { key: "viaje.plan-b", label: "Tengo un plan B si el viaje se demora", hint: "Un contacto y un lugar donde esperar." },
      { key: "viaje.equipaje", label: "Equipaje armado y pesado según las reglas de mi transporte" },
    ],
  },
  {
    id: "llevar",
    title: "Qué llevar",
    icon: "luggage",
    items: [
      { key: "llevar.ropa", label: "Ropa para la temporada en que llegás", hint: "Consultá el clima de Buenos Aires para esas fechas." },
      { key: "llevar.cama-bano", label: "Ropa de cama y toallas, si la residencia no las incluye" },
      { key: "llevar.estudio", label: "Elementos de estudio: notebook, cargadores, apuntes" },
      { key: "llevar.higiene", label: "Artículos de higiene personal para los primeros días" },
      { key: "llevar.medicacion", label: "Medicación habitual y recetas, si corresponde", hint: "Llevá cantidad suficiente para el comienzo." },
      { key: "llevar.adaptador", label: "Adaptador de enchufe, si venís de otro país" },
    ],
  },
  {
    id: "conectividad",
    title: "Conectividad",
    icon: "wifi",
    items: [
      { key: "conex.linea", label: "Plan de datos o línea que funcione en Argentina", hint: "Confirmá con tu operadora o averiguá opciones locales." },
      { key: "conex.wifi", label: "Pregunté cómo funciona el wifi en la residencia" },
      { key: "conex.apps", label: "Descargué las apps que voy a usar: mapas, transporte, mensajería" },
      { key: "conex.contactos", label: "Números importantes guardados y anotados también en papel" },
    ],
  },
  {
    id: "salud",
    title: "Salud y seguridad",
    icon: "health_and_safety",
    items: [
      { key: "salud.cobertura", label: "Cobertura de salud definida", hint: "Obra social, prepaga o seguro de viaje: confirmá qué cubre en la ciudad." },
      { key: "salud.emergencia", label: "Contacto de emergencia compartido con quien corresponda", hint: "Según tus preferencias y necesidades.", guide: "02" },
      { key: "salud.centro", label: "Ubiqué una farmacia y un centro de salud cerca de la residencia" },
      { key: "salud.fichas", label: "Datos médicos relevantes anotados", hint: "Alergias, condiciones o tratamientos que convenga que alguien conozca." },
      { key: "salud.cuidados", label: "Hábitos de cuidado personal pensados para la ciudad", hint: "Pertenencias a la vista, trayectos de noche y avisar adónde vas." },
    ],
  },
  {
    id: "universidad",
    title: "Universidad y trámites",
    icon: "school",
    items: [
      { key: "uni.inscripcion", label: "Inscripción o matrícula confirmada", hint: "Fijate qué falta presentar y hasta cuándo." },
      { key: "uni.calendario", label: "Fechas de inicio de clases y primeras obligaciones anotadas" },
      { key: "uni.trayecto", label: "Probé el trayecto a la facultad, ida y vuelta", hint: "Y una alternativa si hay demoras.", guide: "02" },
      { key: "uni.rutina", label: "Armé una rutina de estudio que se pueda cumplir", guide: "04" },
      { key: "uni.tramites", label: "Trámites personales pendientes identificados", hint: "Por ejemplo documentación de residencia o DNI, si te corresponde." },
    ],
  },
  {
    id: "primeros-dias",
    title: "Primeros días en Buenos Aires",
    icon: "explore",
    items: [
      { key: "dias.barrio", label: "Recorrí el barrio durante el día", hint: "Supermercado, farmacia y lugares para estudiar." },
      { key: "dias.transporte", label: "Cargué mi medio de pago de transporte y probé una línea", hint: "Verificá qué medios de pago acepta cada línea." },
      { key: "dias.compras", label: "Hice las compras básicas" },
      { key: "dias.convivencia", label: "Hablé con mis compañeros sobre silencio, limpieza y visitas", hint: "Un miniacuerdo de convivencia evita conflictos.", guide: "04" },
      { key: "dias.actividades", label: "Busqué actividades culturales o gratuitas para sumarme" },
      { key: "dias.descanso", label: "Reservé tiempo para descansar y adaptarme", guide: "03" },
    ],
  },
  {
    id: "familia",
    title: "Familia y contactos",
    icon: "diversity_3",
    items: [
      { key: "fam.plan", label: "Armamos juntos un plan de llegada: documentos, traslado y presupuesto", guide: "05" },
      { key: "fam.vinculo", label: "Vinculé a mi familiar en EstuRed, si quiero que siga mi llegada", hint: "Verá tu progreso en solo lectura." },
      { key: "fam.frecuencia", label: "Acordamos cada cuánto nos comunicamos", hint: "Acuerdos, no vigilancia." },
      { key: "fam.avisar-llegada", label: "Avisé a mi familia cuando llegué" },
      { key: "fam.emergencias", label: "Sabemos a quién llamar si surge un problema" },
    ],
  },
];

export const ALL_CHECKLIST_KEYS: string[] = ARRIVAL_CHECKLIST.flatMap((c) => c.items.map((i) => i.key));
const KEY_SET: ReadonlySet<string> = new Set(ALL_CHECKLIST_KEYS);

export const CHECKLIST_TOTAL = ALL_CHECKLIST_KEYS.length;

export function isChecklistKey(key: unknown): key is string {
  return typeof key === "string" && KEY_SET.has(key);
}

/** Cantidad de ítems del catálogo tildados (ignora claves que ya no existen). */
export function countChecked(checked: Iterable<string>): number {
  let n = 0;
  for (const k of new Set(checked)) if (KEY_SET.has(k)) n += 1;
  return n;
}

export function checklistPercent(checked: Iterable<string>): number {
  return CHECKLIST_TOTAL === 0 ? 0 : Math.round((countChecked(checked) / CHECKLIST_TOTAL) * 100);
}
