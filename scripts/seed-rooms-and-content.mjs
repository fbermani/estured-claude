/**
 * Seed de habitaciones físicas + contenido editorial (Ciclo 34unvicies).
 * Requiere la migración 0024 aplicada.
 *
 * Para cada residencia real:
 *  1. Crea habitaciones por tipo ("Habitación 1..N") — suficientes para
 *     alojar a los residentes actuales + las camas libres informadas.
 *  2. Asigna cada residente sin habitación a una, llenando en orden
 *     (las camas libres quedan al final, como corresponde).
 *  3. Setea empty_month_charge_percent = 75 (igual que la referencia:
 *     USD 210 sobre renta USD 280).
 *  4. Descripciones extensas + secciones community_statement y
 *     common_areas (estilo referencia `search_results_3`).
 *
 * Uso: node --env-file=.env.local scripts/seed-rooms-and-content.mjs
 * Idempotente: no duplica habitaciones ni reasigna residentes ya asignados.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const CONTENT = {
  "residencia-rio-de-la-plata-demo": {
    label: "Residencia Río de la Plata",
    description:
      "Bienvenido a Residencia Río de la Plata, una casona recuperada a pasos del Jardín Botánico y de las líneas que conectan con UBA Medicina y la Universidad Católica Argentina. Combinamos estudios individuales para quienes buscan independencia con habitaciones compartidas pensadas para la vida en comunidad: cocina amplia por piso, sala de estudio en silencio y terraza compartida. La administración vive en el edificio y coordina el ingreso de cada estudiante personalmente.",
    communityStatement:
      "Fomentamos una comunidad respetuosa y tranquila. Compartimos espacios limpios, horarios justos y promovemos el diálogo entre compañeros. Buscamos estudiantes que valoren el estudio y la amistad.",
    // Vocabulario fijo de COMMON_AREA_OPTIONS (lib/residences/options.ts) —
    // no inventar etiquetas nuevas, el formulario de perfil las pisa por checkbox.
    commonAreas: ["Terraza", "Sala de estudio", "Cocina", "Gimnasio"],
    faq: [
      { question: "¿Se permiten mascotas?", answer: "No, la residencia no admite mascotas por normas de convivencia con espacios compartidos." },
      { question: "¿Hay horario de silencio?", answer: "Sí, de 23hs a 8hs pedimos silencio en los pasillos y habitaciones." },
      { question: "¿Puedo tener visitas?", answer: "Sí, coordinando con anticipación con la administración. No se permiten visitas que pernocten." },
    ],
  },
  "residencia-norte-demo": {
    label: "Residencia Norte",
    description:
      "Residencia Norte es una casa de estilo racionalista renovada en el corazón de Palermo, a metros de Plaza Italia y a minutos de la Universidad de Palermo y UBA Derecho. Los ambientes son luminosos, con techos altos y espacios comunes recién renovados: patio con parrilla, cocina equipada y un living amplio donde la comunidad se junta a estudiar y cocinar. El barrio ofrece cafés de especialidad, librerías y transporte directo a las principales facultades.",
    communityStatement:
      "Somos una casa activa y social: acá se cocina en grupo, se estudia en el living y se arma plan de fin de semana. Buscamos estudiantes con buena onda que también respeten los horarios de descanso.",
    commonAreas: ["Terraza", "Cocina", "Sala de estudio", "Balcón"],
    faq: [
      { question: "¿La cocina está equipada?", answer: "Sí, con heladera, anafe, microondas y utensilios básicos compartidos." },
      { question: "¿Hay estacionamiento?", answer: "No contamos con estacionamiento propio, pero hay opciones a metros de la residencia." },
      { question: "¿Puedo cambiar de habitación una vez que ingreso?", answer: "Sujeto a disponibilidad — coordinalo directamente con la administración." },
    ],
  },
  "casa-almagro-demo": {
    label: "Casa Compartida Almagro",
    description:
      "Casa Compartida Almagro es una casona porteña de patios internos, en un barrio tranquilo y muy bien conectado: a pocas cuadras de UTN Medrano y con subte directo a UBA Económicas. Es la opción más económica de la red sin resignar lo importante: habitaciones ventiladas, cocina compartida ordenada por turnos y un patio con limonero donde la casa entera desayuna cuando está lindo. Ideal para quienes buscan presupuesto cuidado y ambiente familiar.",
    communityStatement:
      "Convivencia simple y de puertas abiertas: turnos de limpieza claros, mate compartido y respeto por el que estudia. La casa se cuida entre todos.",
    commonAreas: ["Terraza", "Cocina", "Sala de estudio"],
    faq: [
      { question: "¿Cuál es la forma de pago?", answer: "Transferencia bancaria mensual, coordinada directamente con la administración de la casa." },
      { question: "¿Se puede fumar en el patio?", answer: "Sí, el patio es el único espacio habilitado para fumar." },
      { question: "¿Hay wifi en todas las habitaciones?", answer: "Sí, la señal llega a toda la casa incluidas las habitaciones." },
    ],
  },
};

async function seedRooms(residenceId) {
  const { data: roomTypes, error } = await admin
    .from("room_types")
    .select("id, name, capacity_per_room, profile_availability(available_count, status)")
    .eq("residence_id", residenceId)
    .eq("is_active", true);
  if (error) throw error;

  for (const rt of roomTypes ?? []) {
    const capacity = Math.max(1, rt.capacity_per_room ?? 1);
    const availability = rt.profile_availability;
    const availableCount = availability?.status === "available_to_confirm" ? (availability.available_count ?? 0) : 0;

    const { data: stays } = await admin
      .from("resident_stays")
      .select("id, room_id")
      .eq("residence_id", residenceId)
      .eq("room_type_id", rt.id)
      .eq("is_current", true)
      .neq("status", "hidden_by_user")
      .neq("status", "inactive");
    const residents = stays ?? [];

    const bedsNeeded = residents.length + availableCount;
    const roomsNeeded = Math.max(1, Math.ceil(bedsNeeded / capacity));

    const { data: existingRooms } = await admin
      .from("rooms")
      .select("id, label, sort_order")
      .eq("room_type_id", rt.id)
      .order("sort_order", { ascending: true });
    const rooms = existingRooms ?? [];

    for (let i = rooms.length; i < roomsNeeded; i++) {
      const label = `Habitación ${i + 1}`;
      const { data: created, error: roomError } = await admin
        .from("rooms")
        .insert({ residence_id: residenceId, room_type_id: rt.id, label, sort_order: i + 1 })
        .select("id, label, sort_order")
        .single();
      if (roomError) throw roomError;
      rooms.push(created);
      console.log(`  + ${rt.name} / ${label}`);
    }

    // Asignación: llena habitaciones en orden hasta capacidad; los ya
    // asignados conservan su habitación.
    const occupancy = new Map(rooms.map((r) => [r.id, 0]));
    for (const stay of residents) {
      if (stay.room_id && occupancy.has(stay.room_id)) {
        occupancy.set(stay.room_id, occupancy.get(stay.room_id) + 1);
      }
    }
    const unassigned = residents.filter((s) => !s.room_id);
    for (const stay of unassigned) {
      const target = rooms.find((r) => (occupancy.get(r.id) ?? 0) < capacity);
      if (!target) break;
      const { error: assignError } = await admin.from("resident_stays").update({ room_id: target.id }).eq("id", stay.id);
      if (assignError) throw assignError;
      occupancy.set(target.id, (occupancy.get(target.id) ?? 0) + 1);
    }
    if (unassigned.length > 0) {
      console.log(`  ${rt.name}: ${unassigned.length} residentes asignados a habitación`);
    }

    // (El % de mes vacío pasó a nivel residencia en la migración 0025 —
    // lo setea scripts/seed-beds-and-conditions.mjs.)
  }
}

async function seedContent(residenceId, content) {
  const { error: descError } = await admin
    .from("residences")
    .update({ description: content.description })
    .eq("id", residenceId);
  if (descError) throw descError;

  for (const [sectionType, sectionContent] of [
    ["community_statement", { quote: content.communityStatement }],
    ["common_areas", { items: content.commonAreas }],
    ["faq", { items: content.faq ?? [] }],
  ]) {
    const { error: sectionError } = await admin
      .from("residence_profile_sections")
      .upsert(
        { residence_id: residenceId, section_type: sectionType, content: sectionContent, is_public: true },
        { onConflict: "residence_id,section_type" },
      );
    if (sectionError) throw sectionError;
  }
  console.log("  + descripción extensa + community_statement + common_areas + faq");
}

async function main() {
  for (const [slug, content] of Object.entries(CONTENT)) {
    const { data: residenceRow, error } = await admin.from("residences").select("id").eq("slug", slug).single();
    if (error || !residenceRow) {
      throw new Error(`No se encontró la residencia con slug "${slug}" — ¿se corrió seed-demo-data.mjs?`);
    }
    console.log(`\n== ${content.label} ==`);
    await seedRooms(residenceRow.id);
    await seedContent(residenceRow.id, content);
  }
  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
