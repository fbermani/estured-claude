import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";

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
  roomTypeId: string | null;
  roomTypeName: string | null;
  roomId: string | null;
  firstName?: string;
  age?: number | null;
  nationality?: string | null;
  countryFlag?: string | null;
  career?: string | null;
  originCity?: string | null;
  bio?: string | null;
  habits?: Record<string, unknown> | null;
  interests?: Record<string, unknown> | null;
};

export type CommunityRoom = {
  roomId: string;
  label: string;
  capacityPerRoom: number;
  occupiedCount: number;
  /** Camas físicas libres en esta habitación (capacidad - ocupantes). */
  freeBeds: number;
};

export type CommunityRoomTypeSummary = {
  roomTypeId: string | null;
  roomTypeName: string;
  /** Etiqueta solo cuando la política no es mixta (ref: "Doble Femenina"). */
  genderPolicyLabel: string | null;
  occupiedCount: number;
  /** `profile_availability.available_count` — null si la residencia no lo informó. */
  availableCount: number | null;
  /** Habitaciones físicas del tipo (migración 0024) — vacío si no se cargaron. */
  rooms: CommunityRoom[];
};

export type CommunitySummary = {
  totalResidents: number;
  pendingActivationCount: number;
  /** Plazas informadas como libres (suma de available_count). */
  totalAvailable: number;
  byRoomType: CommunityRoomTypeSummary[];
  cards: CommunityProfileCard[];
};

type RawStay = {
  id: string;
  status: string;
  student_profile_id: string | null;
  room_id: string | null;
  room_types: { id: string; name: string } | null;
  student_profiles:
    | ({
        birth_date: string | null;
        first_name: string;
        display_age: number | null;
        nationality: string;
        country_flag: string | null;
        origin_city: string | null;
        career: string | null;
        bio: string | null;
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
  const [{ data: stays }, { data: roomTypes }, { data: rooms }] = await Promise.all([
    admin
      .from("resident_stays")
      .select(
        "id, status, student_profile_id, room_id, room_types(id, name), student_profiles(birth_date, first_name, display_age, nationality, country_flag, origin_city, career, bio, habits, interests, student_visibility_settings(show_age_to_registered, show_nationality_to_registered, show_career_to_registered, show_origin_city_to_registered, show_habits_to_registered, show_interests_to_registered, is_individual_profile_visible))",
      )
      .eq("residence_id", residenceId)
      .eq("is_current", true)
      .neq("status", "hidden_by_user")
      .neq("status", "inactive"),
    admin
      .from("room_types")
      .select("id, name, gender_policy, capacity_per_room, profile_availability(status, available_count)")
      .eq("residence_id", residenceId)
      .eq("is_active", true),
    admin
      .from("rooms")
      .select("id, label, room_type_id, sort_order")
      .eq("residence_id", residenceId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  // Camas activas por habitación (migración 0025) — una cama fuera de
  // servicio simplemente no cuenta como lugar; el público no ve el motivo.
  const roomIds = (rooms ?? []).map((r) => r.id);
  const activeBedsByRoom = new Map<string, number>();
  if (roomIds.length > 0) {
    const { data: beds } = await admin
      .from("beds")
      .select("room_id, status")
      .in("room_id", roomIds);
    for (const bed of beds ?? []) {
      if (bed.status === "active") {
        activeBedsByRoom.set(bed.room_id, (activeBedsByRoom.get(bed.room_id) ?? 0) + 1);
      }
    }
  }

  const rows = (stays ?? []) as unknown as RawStay[];

  const totalResidents = rows.length;
  const pendingActivationCount = rows.filter((r) => r.status === "pending_activation" || r.status === "created_by_residence").length;

  const occupiedByRoomType = new Map<string, number>();
  const occupiedByRoom = new Map<string, number>();
  for (const row of rows) {
    const key = row.room_types?.id ?? "sin-tipo";
    occupiedByRoomType.set(key, (occupiedByRoomType.get(key) ?? 0) + 1);
    if (row.room_id) occupiedByRoom.set(row.room_id, (occupiedByRoom.get(row.room_id) ?? 0) + 1);
  }

  const GENDER_LABEL: Record<string, string> = { solo_mujeres: "Femenina", solo_hombres: "Masculina" };
  const byRoomType: CommunityRoomTypeSummary[] = (roomTypes ?? []).map((rt) => {
    // profile_availability tiene unique(room_type_id) — embed singular.
    const availability = rt.profile_availability as unknown as { status: string; available_count: number | null } | null;
    const capacity = Math.max(1, rt.capacity_per_room ?? 1);
    const typeRooms: CommunityRoom[] = (rooms ?? [])
      .filter((room) => room.room_type_id === rt.id)
      .map((room) => {
        const occupiedCount = occupiedByRoom.get(room.id) ?? 0;
        // Si la habitación tiene camas modeladas (0025), la capacidad
        // visible son sus camas ACTIVAS; si no, la capacidad del tipo.
        const effectiveCapacity = activeBedsByRoom.has(room.id)
          ? (activeBedsByRoom.get(room.id) ?? 0)
          : capacity;
        return {
          roomId: room.id,
          label: room.label,
          capacityPerRoom: effectiveCapacity,
          occupiedCount,
          freeBeds: Math.max(0, effectiveCapacity - occupiedCount),
        };
      });
    return {
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      genderPolicyLabel: GENDER_LABEL[rt.gender_policy ?? ""] ?? null,
      occupiedCount: occupiedByRoomType.get(rt.id) ?? 0,
      availableCount: availability?.status === "available_to_confirm" ? (availability.available_count ?? null) : availability ? 0 : null,
      rooms: typeRooms,
    };
  });
  // Residentes sin tipo asignado (room_type_id null) igual cuentan.
  if (occupiedByRoomType.has("sin-tipo")) {
    byRoomType.push({
      roomTypeId: null,
      roomTypeName: "Sin tipo asignado",
      genderPolicyLabel: null,
      occupiedCount: occupiedByRoomType.get("sin-tipo") ?? 0,
      availableCount: null,
      rooms: [],
    });
  }
  const totalAvailable = byRoomType.reduce((sum, rt) => sum + (rt.availableCount ?? 0), 0);

  const cards: CommunityProfileCard[] = rows.map((row) => {
    const roomTypeId = row.room_types?.id ?? null;
    const roomTypeName = row.room_types?.name ?? null;
    const roomId = row.room_id ?? null;
    const settings = row.student_profiles?.student_visibility_settings ?? null;
    // H04: un menor nunca muestra perfil individual (docs/10 §9.2), aunque
    // la fila tenga el maestro en true (datos viejos o cargados a mano). La
    // edad sale de `birth_date` (sin fecha = menor), no del flag `is_minor`.
    const canShowProfile =
      row.status === "active" &&
      row.student_profiles &&
      !isMinorByBirthDate(row.student_profiles.birth_date) &&
      settings?.is_individual_profile_visible;
    if (!canShowProfile || !row.student_profiles || !settings) {
      return { residentStayId: row.id, kind: "placeholder", roomTypeId, roomTypeName, roomId };
    }

    const profile = row.student_profiles;
    if (viewerType === "guest") {
      // Docs/06 §6.2: ningún campo individual tiene toggle "_to_guests"
      // salvo la foto (que no se construye en este ciclo, ver comentario
      // de arriba) — un invitado no logueado solo ve que hay alguien acá.
      return { residentStayId: row.id, kind: "profile", roomTypeId, roomTypeName, roomId, firstName: profile.first_name };
    }

    return {
      residentStayId: row.id,
      kind: "profile",
      roomTypeId,
      roomTypeName,
      roomId,
      firstName: profile.first_name,
      age: settings.show_age_to_registered ? profile.display_age : null,
      nationality: settings.show_nationality_to_registered ? profile.nationality : null,
      countryFlag: settings.show_nationality_to_registered ? profile.country_flag : null,
      career: settings.show_career_to_registered ? profile.career : null,
      originCity: settings.show_origin_city_to_registered ? profile.origin_city : null,
      // La bio la escribe el estudiante para mostrarse; queda detrás del
      // master toggle is_individual_profile_visible (supuesto reversible —
      // docs/06 §6.2 no define toggle propio para bio). Nunca la ve un
      // registrado si el perfil es de un menor (H04): ya no llega acá
      // porque `canShowProfile` lo descarta.
      bio: profile.bio,
      habits: settings.show_habits_to_registered ? profile.habits : null,
      interests: settings.show_interests_to_registered ? profile.interests : null,
    };
  });

  return { totalResidents, pendingActivationCount, totalAvailable, byRoomType, cards };
}
