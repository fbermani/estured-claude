/**
 * Seed acotado de comunidad para UNA residencia (alcance recortado del
 * pedido original de "30+ integrantes en todas las residencias" por
 * cupo semanal casi agotado — ver MEMORY.md Ciclo 34octodevicies).
 *
 * Agrega a "Residencia Río de la Plata": 4 tipos de habitación
 * (Individual/Doble/Triple/Cuádruple) con disponibilidad realista
 * (mezcla de completas y con cupo) + 10 residentes mock con perfiles
 * completos y estadía activa (`resident_stays`).
 *
 * Uso: node --env-file=.env.local scripts/seed-residence-community.mjs
 * Idempotente: usa upsert / checks por email y nombre de room_type.
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
const RESIDENCE_ID = "b2a25202-b08e-4dd1-bfcb-6eb1a7267583"; // Residencia Río de la Plata
const ARS_RATE = 1480;

const ROOM_TYPES = [
  { name: "Individual", capacity_per_room: 1, monthly_price_usd: 320, bathroom_type: "privado", available_count: 2 },
  { name: "Doble", capacity_per_room: 2, monthly_price_usd: 220, bathroom_type: "compartido", available_count: 1 },
  { name: "Triple", capacity_per_room: 3, monthly_price_usd: 180, bathroom_type: "compartido", available_count: 0 },
  { name: "Cuádruple", capacity_per_room: 4, monthly_price_usd: 150, bathroom_type: "compartido", available_count: 2 },
];

const RESIDENTS = [
  { email: "martina.cavalcanti@estured.test", first: "Martina", last: "Cavalcanti", birth: "2004-05-12", nat: "Brasil", city: "São Paulo", career: "Relaciones Internacionales", room: "Individual" },
  { email: "diego.ramirez@estured.test", first: "Diego", last: "Ramírez", birth: "2003-11-03", nat: "Argentina", city: "Córdoba", career: "Ingeniería Industrial", room: "Individual" },
  { email: "juan.gonzalez@estured.test", first: "Juan", last: "González", birth: "2005-02-20", nat: "Colombia", city: "Bogotá", career: "Derecho", room: "Doble" },
  { email: "sofia.alvarez@estured.test", first: "Sofía", last: "Álvarez", birth: "2004-08-17", nat: "Uruguay", city: "Montevideo", career: "Arquitectura", room: "Doble" },
  { email: "mateo.rojas@estured.test", first: "Mateo", last: "Rojas", birth: "2005-01-09", nat: "Chile", city: "Santiago", career: "Diseño Gráfico", room: "Doble" },
  { email: "valentina.torres@estured.test", first: "Valentina", last: "Torres", birth: "2004-04-25", nat: "Perú", city: "Lima", career: "Psicología", room: "Triple" },
  { email: "liam.lawson@estured.test", first: "Liam", last: "Lawson", birth: "2003-09-30", nat: "Reino Unido", city: "Londres", career: "Economía", room: "Triple" },
  { email: "camila.fernandez@estured.test", first: "Camila", last: "Fernández", birth: "2005-06-14", nat: "Argentina", city: "Rosario", career: "Medicina", room: "Triple" },
  { email: "ana.schmidt@estured.test", first: "Ana", last: "Schmidt", birth: "2004-12-01", nat: "Alemania", city: "Berlín", career: "Ciencias Políticas", room: "Cuádruple" },
  { email: "tomas.medina@estured.test", first: "Tomás", last: "Medina", birth: "2003-07-22", nat: "Bolivia", city: "La Paz", career: "Contador Público", room: "Cuádruple" },
];

function lastInitial(last) {
  return `${last.trim()[0]}.`;
}
function displayAge(birth) {
  const diff = Date.now() - new Date(birth).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

async function ensureRoomTypes() {
  const { data: existing } = await admin.from("room_types").select("id, name").eq("residence_id", RESIDENCE_ID);
  const byName = Object.fromEntries((existing ?? []).map((r) => [r.name, r.id]));
  const idByName = {};
  for (const rt of ROOM_TYPES) {
    if (byName[rt.name]) {
      idByName[rt.name] = byName[rt.name];
      continue;
    }
    const { data, error } = await admin
      .from("room_types")
      .insert({
        residence_id: RESIDENCE_ID,
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
    console.log(`+ room_type ${rt.name} -> ${data.id}`);
  }
  return idByName;
}

async function ensureAvailability(roomTypeIdByName) {
  for (const rt of ROOM_TYPES) {
    const roomTypeId = roomTypeIdByName[rt.name];
    const { error } = await admin.from("profile_availability").upsert(
      {
        residence_id: RESIDENCE_ID,
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
  console.log(`+ disponibilidad actualizada para ${ROOM_TYPES.length} tipos de habitación`);
}

async function ensureResident(r, roomTypeIdByName) {
  const email = r.email.toLowerCase();

  let userId;
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existingAuth = existingUsers?.users.find((u) => u.email?.toLowerCase() === email);
  if (existingAuth) {
    userId = existingAuth.id;
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`auth ${email}: ${error.message}`);
    userId = created.user.id;
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
        first_name: r.first,
        last_name: r.last,
        last_initial: lastInitial(r.last),
        birth_date: r.birth,
        display_age: displayAge(r.birth),
        nationality: r.nat,
        origin_city: r.city,
        origin_country: r.nat,
        career: r.career,
        study_institution_private: "Universidad en CABA",
        academic_objective: `Cursar ${r.career} en CABA.`,
        bio: `Estudiante de ${r.career}, de ${r.city}.`,
        is_minor: false,
        avatar_type: "initials",
        profile_completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`student_profile ${email}: ${error.message}`);
    studentProfileId = profile.id;
    console.log(`+ perfil ${r.first} ${r.last} (${r.nat})`);
  }

  const { data: existingStay } = await admin
    .from("resident_stays")
    .select("id")
    .eq("residence_id", RESIDENCE_ID)
    .eq("student_profile_id", studentProfileId)
    .eq("is_current", true)
    .maybeSingle();
  if (existingStay) return;

  const { error: stayError } = await admin.from("resident_stays").insert({
    student_profile_id: studentProfileId,
    residence_id: RESIDENCE_ID,
    room_type_id: roomTypeIdByName[r.room],
    invite_email: email,
    status: "active",
    start_date: "2026-03-01",
    is_current: true,
  });
  if (stayError) throw new Error(`resident_stay ${email}: ${stayError.message}`);
  console.log(`+ resident_stay ${r.first} ${r.last} -> ${r.room}`);
}

async function main() {
  const roomTypeIdByName = await ensureRoomTypes();
  await ensureAvailability(roomTypeIdByName);
  for (const r of RESIDENTS) {
    await ensureResident(r, roomTypeIdByName);
  }
  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
