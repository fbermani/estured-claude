/**
 * Seed de comunidad para TODAS las residencias reales (Ciclo 34undevicies,
 * completa lo recortado en el Ciclo 34octodevicies por cupo semanal).
 *
 * Para cada residencia configurada: asegura los 4 tipos de habitación
 * (Individual/Doble/Triple/Cuádruple) con disponibilidad mixta, y suma
 * residentes mock (perfil completo + `resident_stays` activa) hasta
 * llegar al mínimo pedido (30 por residencia).
 *
 * Uso: node --env-file=.env.local scripts/seed-residence-community.mjs
 * Idempotente: no duplica room_types por nombre ni residentes por email;
 * si ya hay >= target, no agrega de más.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USERS_PASSWORD;
if (!url || !serviceRoleKey || !password) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const ARS_RATE = 1480;
const TARGET_PER_RESIDENCE = 30;

const RESIDENCES = [
  {
    id: "b2a25202-b08e-4dd1-bfcb-6eb1a7267583",
    label: "Residencia Río de la Plata",
    roomTypes: [
      { name: "Individual", capacity_per_room: 1, monthly_price_usd: 320, bathroom_type: "privado", available_count: 2 },
      { name: "Doble", capacity_per_room: 2, monthly_price_usd: 220, bathroom_type: "compartido", available_count: 0 },
      { name: "Triple", capacity_per_room: 3, monthly_price_usd: 180, bathroom_type: "compartido", available_count: 3 },
      { name: "Cuádruple", capacity_per_room: 4, monthly_price_usd: 150, bathroom_type: "compartido", available_count: 0 },
    ],
  },
  {
    id: "06addddb-349c-41ba-9a4c-3e40c7189042",
    label: "Residencia Norte",
    roomTypes: [
      { name: "Individual", capacity_per_room: 1, monthly_price_usd: 340, bathroom_type: "privado", available_count: 1 },
      { name: "Doble", capacity_per_room: 2, monthly_price_usd: 230, bathroom_type: "compartido", available_count: 2 },
      { name: "Triple", capacity_per_room: 3, monthly_price_usd: 190, bathroom_type: "compartido", available_count: 0 },
      { name: "Cuádruple", capacity_per_room: 4, monthly_price_usd: 160, bathroom_type: "compartido", available_count: 0 },
    ],
  },
  {
    id: "063d9032-0684-44d2-90dd-6a73faa352d4",
    label: "Casa Compartida Almagro",
    roomTypes: [
      { name: "Individual", capacity_per_room: 1, monthly_price_usd: 260, bathroom_type: "privado", available_count: 0 },
      { name: "Doble", capacity_per_room: 2, monthly_price_usd: 180, bathroom_type: "compartido", available_count: 3 },
      { name: "Triple", capacity_per_room: 3, monthly_price_usd: 150, bathroom_type: "compartido", available_count: 1 },
      { name: "Cuádruple", capacity_per_room: 4, monthly_price_usd: 120, bathroom_type: "compartido", available_count: 0 },
    ],
  },
];

const FIRST_NAMES = [
  "Martina", "Diego", "Juan", "Sofía", "Mateo", "Valentina", "Liam", "Camila", "Ana", "Tomás",
  "Julieta", "Nicolás", "Florencia", "Franco", "Agustina", "Lautaro", "Lucía", "Ignacio", "Carla", "Bruno",
  "Milagros", "Agustín", "Micaela", "Benjamín", "Rocío", "Ciro", "Antonella", "Dante", "Brenda", "Emiliano",
  "Delfina", "Facundo", "Emilia", "Gonzalo", "Guadalupe", "Hernán", "Ivana", "Ivo", "Josefina", "Joaquín",
  "Karen", "Kevin", "Luciana", "Leandro", "Melina", "Marcos", "Nadia", "Nahuel", "Paula", "Octavio",
  "Renata", "Pedro", "Sabrina", "Rodrigo", "Tamara", "Santino", "Yamila", "Thiago", "Zoe", "Uriel",
  "Catalina", "Maximiliano", "Abril", "Elias", "Constanza", "Bautista", "Victoria", "Gael", "Isabella", "Lorenzo",
  "Malena", "Simón", "Olivia", "Vicente", "Pilar", "Ramiro", "Trinidad", "Federico", "Amparo", "Matías",
];
const LAST_NAMES = [
  "Cavalcanti", "Ramírez", "González", "Álvarez", "Rojas", "Torres", "Lawson", "Fernández", "Schmidt", "Medina",
  "Pereyra", "Gómez", "Díaz", "Sosa", "Núñez", "Molina", "Silva", "Suárez", "Ortiz", "Herrera",
  "Castro", "Romero", "Flores", "Acosta", "Ibarra", "Vega", "Aguirre", "Benítez", "Cabrera", "Domínguez",
  "Escobar", "Figueroa", "Guerrero", "Hidalgo", "Iturralde", "Juárez", "Klein", "Leiva", "Maidana", "Navarro",
  "Ocampo", "Paredes", "Quiroga", "Ríos", "Salgado", "Toledo", "Urrutia", "Valdez", "Weber", "Zambrano",
  "Almeida", "Barreto", "Correa", "Delgado", "Espinoza", "Franco", "Godoy", "Highton", "Insaurralde", "Jara",
  "Kowalski", "Lima", "Machado", "Ninci", "Ojeda", "Prieto", "Quintero", "Reyes", "Serrano", "Tapia",
  "Uzal", "Vidal", "Wagner", "Ximénez", "Yáñez", "Zapata", "Bianchi", "Carrizo",
];
const NATIONALITIES = [
  { nat: "Argentina", cities: ["Rosario", "Córdoba", "Mendoza", "Salta", "Mar del Plata", "Tucumán"] },
  { nat: "Brasil", cities: ["São Paulo", "Río de Janeiro", "Curitiba", "Porto Alegre"] },
  { nat: "Chile", cities: ["Santiago", "Valparaíso", "Concepción"] },
  { nat: "Colombia", cities: ["Bogotá", "Medellín", "Cali"] },
  { nat: "Uruguay", cities: ["Montevideo", "Salto"] },
  { nat: "Perú", cities: ["Lima", "Arequipa"] },
  { nat: "Bolivia", cities: ["La Paz", "Santa Cruz"] },
  { nat: "Paraguay", cities: ["Asunción"] },
  { nat: "México", cities: ["Ciudad de México", "Guadalajara"] },
  { nat: "España", cities: ["Madrid", "Barcelona"] },
  { nat: "Alemania", cities: ["Berlín", "Múnich"] },
  { nat: "Reino Unido", cities: ["Londres", "Manchester"] },
  { nat: "Francia", cities: ["París", "Lyon"] },
  { nat: "Italia", cities: ["Roma", "Milán"] },
  { nat: "Estados Unidos", cities: ["Nueva York", "Chicago"] },
  { nat: "Ecuador", cities: ["Quito", "Guayaquil"] },
];
const CAREERS = [
  "Medicina", "Derecho", "Ingeniería Industrial", "Arquitectura", "Psicología", "Ciencias Políticas",
  "Economía", "Diseño Gráfico", "Relaciones Internacionales", "Contador Público", "Comunicación Social",
  "Ingeniería en Sistemas", "Odontología", "Veterinaria", "Administración de Empresas", "Biología",
  "Letras", "Nutrición", "Kinesiología", "Ciencias de la Educación",
];
const INTERESTS_POOL = [
  "Lectura", "Música", "Cine", "Deportes", "Fotografía", "Cocina",
  "Viajes", "Arte", "Videojuegos", "Yoga", "Voluntariado", "Idiomas",
];
const HABITS_POOL = [
  "Madruga", "Trasnocha", "Estudia en silencio", "Escucha música mientras estudia",
  "Cocina seguido", "Hace ejercicio", "Ordenado/a", "Vida social activa",
];
const FLAG_BY_NATIONALITY = {
  Argentina: "🇦🇷", Brasil: "🇧🇷", Chile: "🇨🇱", Colombia: "🇨🇴", Uruguay: "🇺🇾", Perú: "🇵🇪",
  Bolivia: "🇧🇴", Paraguay: "🇵🇾", México: "🇲🇽", España: "🇪🇸", Alemania: "🇩🇪",
  "Reino Unido": "🇬🇧", Francia: "🇫🇷", Italia: "🇮🇹", "Estados Unidos": "🇺🇸", Ecuador: "🇪🇨",
};

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function birthDateFor(idx) {
  const year = 2001 + (idx % 7); // 18-24 años aprox
  const month = 1 + (idx % 12);
  const day = 1 + (idx % 27);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function displayAge(birth) {
  const diff = Date.now() - new Date(birth).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
function lastInitial(last) {
  return `${last.trim()[0]}.`;
}

function generatePerson(globalIdx, usedEmails) {
  const first = FIRST_NAMES[globalIdx % FIRST_NAMES.length];
  const last = LAST_NAMES[(globalIdx * 7 + 3) % LAST_NAMES.length];
  const { nat, cities } = NATIONALITIES[(globalIdx * 5 + 1) % NATIONALITIES.length];
  const city = cities[globalIdx % cities.length];
  const career = CAREERS[(globalIdx * 3 + 2) % CAREERS.length];
  const birth = birthDateFor(globalIdx);
  const flag = FLAG_BY_NATIONALITY[nat] ?? null;
  const habits = [HABITS_POOL[globalIdx % HABITS_POOL.length]];
  const interests = [
    INTERESTS_POOL[globalIdx % INTERESTS_POOL.length],
    INTERESTS_POOL[(globalIdx * 3 + 1) % INTERESTS_POOL.length],
  ];

  let email = `${normalize(first)}.${normalize(last)}@estured.test`;
  let suffix = 2;
  while (usedEmails.has(email)) {
    email = `${normalize(first)}.${normalize(last)}${suffix}@estured.test`;
    suffix += 1;
  }
  usedEmails.add(email);

  return { email, first, last, birth, nat, city, career, flag, habits, interests };
}

async function ensureRoomTypes(residenceId, roomTypesConfig) {
  const { data: existing } = await admin.from("room_types").select("id, name").eq("residence_id", residenceId);
  const byName = Object.fromEntries((existing ?? []).map((r) => [r.name, r.id]));
  const idByName = {};
  for (const rt of roomTypesConfig) {
    if (byName[rt.name]) {
      idByName[rt.name] = byName[rt.name];
      continue;
    }
    const { data, error } = await admin
      .from("room_types")
      .insert({
        residence_id: residenceId,
        name: rt.name,
        capacity_per_room: rt.capacity_per_room,
        bathroom_type: rt.bathroom_type,
        gender_policy: "mixto",
        monthly_price_usd: rt.monthly_price_usd,
        monthly_price_ars: rt.monthly_price_usd * ARS_RATE,
        deposit_is_refundable: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`room_type ${rt.name}: ${error.message}`);
    idByName[rt.name] = data.id;
    console.log(`  + room_type ${rt.name} -> ${data.id}`);
  }
  return idByName;
}

async function ensureAvailability(residenceId, roomTypesConfig, idByName) {
  for (const rt of roomTypesConfig) {
    const roomTypeId = idByName[rt.name];
    const { error } = await admin.from("profile_availability").upsert(
      {
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: rt.available_count > 0 ? "available_to_confirm" : "full",
        available_count: rt.available_count,
        available_from: rt.available_count > 0 ? new Date().toISOString().slice(0, 10) : null,
        last_confirmed_at: new Date().toISOString(),
      },
      { onConflict: "room_type_id" },
    );
    if (error) throw new Error(`availability ${rt.name}: ${error.message}`);
  }
  console.log(`  + disponibilidad actualizada (${roomTypesConfig.length} tipos)`);
}

async function ensureResident(person, residenceId, roomTypeId, allAuthUsers) {
  const email = person.email.toLowerCase();

  let userId = allAuthUsers.get(email);
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`auth ${email}: ${error.message}`);
    userId = created.user.id;
    allAuthUsers.set(email, userId);
  }

  await admin.from("users").upsert({ id: userId, email, primary_role: "student" }, { onConflict: "id" });

  const { data: existingProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let studentProfileId = existingProfile?.id;
  if (!studentProfileId) {
    const { data: profile, error } = await admin
      .from("student_profiles")
      .insert({
        user_id: userId,
        first_name: person.first,
        last_name: person.last,
        last_initial: lastInitial(person.last),
        birth_date: person.birth,
        display_age: displayAge(person.birth),
        nationality: person.nat,
        country_flag: person.flag,
        origin_city: person.city,
        origin_country: person.nat,
        career: person.career,
        study_institution_private: "Universidad en CABA",
        academic_objective: `Cursar ${person.career} en CABA.`,
        bio: `Estudiante de ${person.career}, de ${person.city}.`,
        habits: { items: person.habits },
        interests: { items: person.interests },
        is_minor: false,
        avatar_type: "initials",
        profile_completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`student_profile ${email}: ${error.message}`);
    studentProfileId = profile.id;

    // Perfiles de demo pensados para mostrarse en la comunidad — visibilidad
    // completa a propósito (default real es privado, ver docs/06 §6.2).
    await admin.from("student_visibility_settings").upsert(
      {
        student_profile_id: studentProfileId,
        is_individual_profile_visible: true,
        show_age_to_registered: true,
        show_nationality_to_registered: true,
        show_career_to_registered: true,
        show_origin_city_to_registered: true,
        show_habits_to_registered: true,
        show_interests_to_registered: true,
      },
      { onConflict: "student_profile_id" },
    );
  }

  const { data: existingStay } = await admin
    .from("resident_stays")
    .select("id")
    .eq("residence_id", residenceId)
    .eq("student_profile_id", studentProfileId)
    .eq("is_current", true)
    .maybeSingle();
  if (existingStay) return false;

  const { error: stayError } = await admin.from("resident_stays").insert({
    student_profile_id: studentProfileId,
    residence_id: residenceId,
    room_type_id: roomTypeId,
    invite_email: email,
    status: "active",
    start_date: "2026-03-01",
    is_current: true,
  });
  if (stayError) throw new Error(`resident_stay ${email}: ${stayError.message}`);
  return true;
}

async function main() {
  // Cache global de usuarios de auth ya existentes, para no re-listar por cada persona.
  const allAuthUsers = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) allAuthUsers.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
    page += 1;
  }
  const usedEmails = new Set(allAuthUsers.keys());

  let globalIdx = 0;
  for (const residence of RESIDENCES) {
    console.log(`\n== ${residence.label} ==`);
    const idByName = await ensureRoomTypes(residence.id, residence.roomTypes);
    await ensureAvailability(residence.id, residence.roomTypes, idByName);

    const { count: currentCount } = await admin
      .from("resident_stays")
      .select("*", { count: "exact", head: true })
      .eq("residence_id", residence.id)
      .eq("is_current", true);

    const toAdd = Math.max(0, TARGET_PER_RESIDENCE - (currentCount ?? 0));
    if (toAdd === 0) {
      console.log(`  ya tiene ${currentCount} residentes (>= ${TARGET_PER_RESIDENCE}), no se agrega ninguno.`);
      continue;
    }
    console.log(`  tiene ${currentCount}, agregando ${toAdd} para llegar a ${TARGET_PER_RESIDENCE}...`);

    const roomTypeNames = residence.roomTypes.map((rt) => rt.name);
    let added = 0;
    let attempts = 0;
    while (added < toAdd && attempts < toAdd * 3) {
      const person = generatePerson(globalIdx, usedEmails);
      globalIdx += 1;
      attempts += 1;
      const roomTypeName = roomTypeNames[added % roomTypeNames.length];
      const roomTypeId = idByName[roomTypeName];
      const created = await ensureResident(person, residence.id, roomTypeId, allAuthUsers);
      if (created) {
        added += 1;
        console.log(`  + ${person.first} ${person.last} (${person.nat}) -> ${roomTypeName}`);
      }
    }
  }

  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
