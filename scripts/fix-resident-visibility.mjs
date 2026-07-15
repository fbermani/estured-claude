/**
 * Fix puntual (Ciclo 34undevicies): los residentes mock sembrados por
 * `seed-residence-community.mjs` no tenían `student_visibility_settings`,
 * así que `getCommunityVisibility` los mostraba como "Plaza ocupada /
 * pendiente de activar cuenta" en vez de su perfil real — al revés de lo
 * pedido ("mostrar la comunidad, los perfiles"). Habilita visibilidad
 * completa + bandera de país para todos los residentes activos de las 3
 * residencias reales. Son perfiles de demo pensados para mostrarse, no
 * estudiantes reales — por eso acá sí se habilita todo, a diferencia del
 * default privado de `seed-demo-users.mjs`.
 *
 * Uso: node --env-file=.env.local scripts/fix-resident-visibility.mjs
 * Idempotente (upsert).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const RESIDENCE_IDS = [
  "b2a25202-b08e-4dd1-bfcb-6eb1a7267583",
  "06addddb-349c-41ba-9a4c-3e40c7189042",
  "063d9032-0684-44d2-90dd-6a73faa352d4",
];

const FLAG_BY_NATIONALITY = {
  Argentina: "🇦🇷",
  Brasil: "🇧🇷",
  Chile: "🇨🇱",
  Colombia: "🇨🇴",
  Uruguay: "🇺🇾",
  Perú: "🇵🇪",
  Bolivia: "🇧🇴",
  Paraguay: "🇵🇾",
  México: "🇲🇽",
  España: "🇪🇸",
  Alemania: "🇩🇪",
  "Reino Unido": "🇬🇧",
  Francia: "🇫🇷",
  Italia: "🇮🇹",
  "Estados Unidos": "🇺🇸",
  Ecuador: "🇪🇨",
};

const INTERESTS_POOL = [
  "Lectura", "Música", "Cine", "Deportes", "Fotografía", "Cocina",
  "Viajes", "Arte", "Videojuegos", "Yoga", "Voluntariado", "Idiomas",
];
const HABITS_POOL = [
  "Madruga", "Trasnocha", "Estudia en silencio", "Escucha música mientras estudia",
  "Cocina seguido", "Hace ejercicio", "Ordenado/a", "Vida social activa",
];

async function main() {
  const { data: stays, error } = await admin
    .from("resident_stays")
    .select("student_profile_id, student_profiles(id, nationality, country_flag, habits, interests)")
    .in("residence_id", RESIDENCE_IDS)
    .eq("is_current", true)
    .not("student_profile_id", "is", null);
  if (error) throw error;

  let fixedVisibility = 0;
  let fixedFlags = 0;
  let fixedSignals = 0;
  const seen = new Set();
  let idx = 0;
  for (const stay of stays ?? []) {
    const profile = stay.student_profiles;
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    idx += 1;

    const { error: visError } = await admin.from("student_visibility_settings").upsert(
      {
        student_profile_id: profile.id,
        is_individual_profile_visible: true,
        show_age_to_registered: true,
        show_nationality_to_registered: true,
        show_career_to_registered: true,
        show_origin_city_to_registered: true,
        show_habits_to_registered: true,
        show_interests_to_registered: true,
        show_photo_to_registered: false,
        show_photo_to_guests: false,
      },
      { onConflict: "student_profile_id" },
    );
    if (visError) {
      console.error(`x visibility ${profile.id}: ${visError.message}`);
      continue;
    }
    fixedVisibility += 1;

    if (!profile.country_flag && FLAG_BY_NATIONALITY[profile.nationality]) {
      const { error: flagError } = await admin
        .from("student_profiles")
        .update({ country_flag: FLAG_BY_NATIONALITY[profile.nationality] })
        .eq("id", profile.id);
      if (!flagError) fixedFlags += 1;
    }

    const hasHabits = profile.habits && Object.keys(profile.habits).length > 0;
    const hasInterests = profile.interests && Object.keys(profile.interests).length > 0;
    if (!hasHabits || !hasInterests) {
      const update = {};
      if (!hasHabits) update.habits = { items: [HABITS_POOL[idx % HABITS_POOL.length]] };
      if (!hasInterests) {
        update.interests = {
          items: [INTERESTS_POOL[idx % INTERESTS_POOL.length], INTERESTS_POOL[(idx * 3 + 1) % INTERESTS_POOL.length]],
        };
      }
      const { error: signalsError } = await admin.from("student_profiles").update(update).eq("id", profile.id);
      if (!signalsError) fixedSignals += 1;
    }
  }

  console.log(
    `Visibilidad habilitada en ${fixedVisibility} perfiles. Bandera agregada en ${fixedFlags}. Hábitos/intereses en ${fixedSignals}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
