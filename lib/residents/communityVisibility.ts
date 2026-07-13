import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Docs/05 §15 — reglas de visibilidad de comunidad. `guest` = no
 * logueado o logueado pero no es compañero/registrado relevante;
 * `registered` = cualquier usuario logueado (docs/05 §15.3 no
 * distingue "compañero" de "cualquier registrado" salvo por el propio
 * estudiante, así que se trata igual). Nunca se exponen apellido
 * completo, email, teléfono, fecha de nacimiento, universidad ni
 * documentos (docs/05 §15.4) — ninguno de esos campos entra a esta
 * función, ni siquiera detrás de un toggle. No se resuelve la foto de
 * perfil (`student_profiles.photo_file_id` / `show_photo_to_*`):
 * ningún flujo de carga de fotos existe todavía en el proyecto, así
 * que no se construye una tarjeta que "casi" muestra una foto que
 * nunca hay — pendiente para cuando exista upload real.
 */
export type CommunityViewerType = "guest" | "registered";

export type CommunityProfileCard = {
  residentStayId: string;
  kind: "profile" | "placeholder";
  roomTypeName: string | null;
  firstName?: string;
  age?: number | null;
  nationality?: string | null;
  countryFlag?: string | null;
  career?: string | null;
  originCity?: string | null;
  habits?: Record<string, unknown> | null;
  interests?: Record<string, unknown> | null;
};

export type CommunitySummary = {
  totalResidents: number;
  pendingActivationCount: number;
  byRoomType: { roomTypeId: string | null; roomTypeName: string; count: number }[];
  cards: CommunityProfileCard[];
};

type RawStay = {
  id: string;
  status: string;
  student_profile_id: string | null;
  room_types: { id: string; name: string } | null;
  student_profiles:
    | ({
        first_name: string;
        display_age: number | null;
        nationality: string;
        country_flag: string | null;
        origin_city: string | null;
        career: string | null;
        habits: Record<string, unknown>;
        interests: Record<string, unknown>;
        student_visibility_settings: {
          show_age_to_registered: boolean;
          show_nationality_to_registered: boolean;
          show_career_to_registered: boolean;
          show_origin_city_to_registered: boolean;
          show_habits_to_registered: boolean;
          show_interests_to_registered: boolean;
          is_individual_profile_visible: boolean;
        } | null;
      })
    | null;
};

/** Docs/06 §15.1-15.2 — agregados + tarjetas individuales para la comunidad visible de una residencia (Perfil Verificado, agrupado por `room_type_id`). */
export async function getCommunityVisibility(
  admin: SupabaseClient,
  residenceId: string,
  viewerType: CommunityViewerType,
): Promise<CommunitySummary> {
  const { data: stays } = await admin
    .from("resident_stays")
    .select(
      "id, status, student_profile_id, room_types(id, name), student_profiles(first_name, display_age, nationality, country_flag, origin_city, career, habits, interests, student_visibility_settings(show_age_to_registered, show_nationality_to_registered, show_career_to_registered, show_origin_city_to_registered, show_habits_to_registered, show_interests_to_registered, is_individual_profile_visible))",
    )
    .eq("residence_id", residenceId)
    .eq("is_current", true)
    .neq("status", "hidden_by_user")
    .neq("status", "inactive");

  const rows = (stays ?? []) as unknown as RawStay[];

  const totalResidents = rows.length;
  const pendingActivationCount = rows.filter((r) => r.status === "pending_activation" || r.status === "created_by_residence").length;

  const byRoomTypeMap = new Map<string, { roomTypeId: string | null; roomTypeName: string; count: number }>();
  for (const row of rows) {
    const key = row.room_types?.id ?? "sin-tipo";
    const label = row.room_types?.name ?? "Sin tipo asignado";
    const existing = byRoomTypeMap.get(key);
    if (existing) existing.count += 1;
    else byRoomTypeMap.set(key, { roomTypeId: row.room_types?.id ?? null, roomTypeName: label, count: 1 });
  }

  const cards: CommunityProfileCard[] = rows.map((row) => {
    const roomTypeName = row.room_types?.name ?? null;
    const settings = row.student_profiles?.student_visibility_settings ?? null;
    const canShowProfile = row.status === "active" && row.student_profiles && settings?.is_individual_profile_visible;
    if (!canShowProfile || !row.student_profiles || !settings) {
      return { residentStayId: row.id, kind: "placeholder", roomTypeName };
    }

    const profile = row.student_profiles;
    if (viewerType === "guest") {
      // Docs/06 §6.2: ningún campo individual tiene toggle "_to_guests"
      // salvo la foto (que no se construye en este ciclo, ver comentario
      // de arriba) — un invitado no logueado solo ve que hay alguien acá.
      return { residentStayId: row.id, kind: "profile", roomTypeName, firstName: profile.first_name };
    }

    return {
      residentStayId: row.id,
      kind: "profile",
      roomTypeName,
      firstName: profile.first_name,
      age: settings.show_age_to_registered ? profile.display_age : null,
      nationality: settings.show_nationality_to_registered ? profile.nationality : null,
      countryFlag: settings.show_nationality_to_registered ? profile.country_flag : null,
      career: settings.show_career_to_registered ? profile.career : null,
      originCity: settings.show_origin_city_to_registered ? profile.origin_city : null,
      habits: settings.show_habits_to_registered ? profile.habits : null,
      interests: settings.show_interests_to_registered ? profile.interests : null,
    };
  });

  return { totalResidents, pendingActivationCount, byRoomType: Array.from(byRoomTypeMap.values()), cards };
}
