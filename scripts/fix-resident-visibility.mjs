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

// Resuelto por slug en runtime, no hardcodeado — un reseed de
// seed-demo-data.mjs borra y recrea las residencias con UUIDs nuevos
// (Ciclo 35sexdecies, mismo bug ya corregido en upload-residence-photos.mjs).
const RESIDENCE_SLUGS = ["residencia-rio-de-la-plata-demo", "residencia-norte-demo", "casa-almagro-demo"];
const { data: residenceRows, error: residenceLookupError } = await admin
  .from("residences")
  .select("id")
  .in("slug", RESIDENCE_SLUGS);
if (residenceLookupError) throw residenceLookupError;
const RESIDENCE_IDS = (residenceRows ?? []).map((r) => r.id);

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

// Mismo vocabulario exacto que lib/students/profileOptions.ts
// (INTEREST_OPTIONS/HABIT_OPTIONS) — un script .mjs no puede importar
// ese archivo .ts directamente, así que se duplica a propósito, pero
// las palabras tienen que coincidir letra por letra: si no coinciden,
// el estudiante que edita su perfil real ve estos chips sin marcar
// (la wording vieja no matchea ninguna opción del selector nuevo) y al
// guardar el whitelist server-side descarta el valor legado en
// silencio — encontrado en vivo en Ciclo 36 editando el perfil de
// Lucía (ver MEMORY.md).
const INTERESTS_POOL = [
  "Deportes", "Música", "Cine", "Series", "Lectura", "Tecnología",
  "Programación", "Gaming", "Viajes", "Idiomas", "Cocina", "Fotografía",
  "Arte", "Naturaleza", "Emprendimiento", "Voluntariado",
];
const HABITS_POOL = [
  "Madrugador", "Nocturno", "Ordenado", "Muy sociable", "Tranquilo",
  "Me gusta cocinar", "Estudio en silencio", "Escucho música para estudiar",
  "No fumo", "Fumador", "Hago deporte", "Trabajo mientras estudio",
  "Recibo visitas ocasionalmente",
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

    // Siempre pisa con el vocabulario canónico vigente (no solo cuando
    // está vacío): un student_profile con `{items: []}` (perfil real
    // editado a través del formulario nuevo con chips que no matchean
    // ninguna opción vieja) o con wording de un pool anterior nunca se
    // habría corregido con un chequeo de "ya tiene algo" — este script
    // es solo para perfiles de demo pensados para mostrarse, no hay
    // edición manual real que este pisado pueda destruir.
    const { error: signalsError } = await admin
      .from("student_profiles")
      .update({
        habits: { items: [HABITS_POOL[idx % HABITS_POOL.length]] },
        interests: {
          items: [INTERESTS_POOL[idx % INTERESTS_POOL.length], INTERESTS_POOL[(idx * 3 + 1) % INTERESTS_POOL.length]],
        },
      })
      .eq("id", profile.id);
    if (!signalsError) fixedSignals += 1;
  }

  console.log(
    `Visibilidad habilitada en ${fixedVisibility} perfiles. Bandera agregada en ${fixedFlags}. Hábitos/intereses en ${fixedSignals}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
