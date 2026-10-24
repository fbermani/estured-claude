import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StayChangeStatus } from "@/lib/stayChange/status";

/** Fila de `stay_change_intents` tal como la leen las acciones del servidor (service role). */
export type StayChangeIntentRow = {
  id: string;
  student_profile_id: string;
  resident_stay_id: string | null;
  reservation_id: string | null;
  current_residence_id: string;
  status: StayChangeStatus;
  estimated_exit_date: string | null;
  student_message: string | null;
  residence_response_message: string | null;
  residence_exit_costs_text: string | null;
  residence_exit_costs_usd: number | string | null;
  residence_exit_conditions_text: string | null;
  residence_exit_details_text: string | null;
  residence_responded_at: string | null;
  residence_responded_by_user_id: string | null;
  residence_response_edit_count: number;
  response_seen_by_student_at: string | null;
  student_edited_at: string | null;
  guardian_confirmed_at: string | null;
  resolved_reservation_id: string | null;
  resolved_new_start_date: string | null;
  resolved_at: string | null;
  expires_at: string | null;
  last_keep_alive_notified_at: string | null;
  created_by_user_id: string;
  created_at: string;
};

export const INTENT_COLUMNS =
  "id, student_profile_id, resident_stay_id, reservation_id, current_residence_id, status, estimated_exit_date, student_message, residence_response_message, residence_exit_costs_text, residence_exit_costs_usd, residence_exit_conditions_text, residence_exit_details_text, residence_responded_at, residence_responded_by_user_id, residence_response_edit_count, response_seen_by_student_at, student_edited_at, guardian_confirmed_at, resolved_reservation_id, resolved_new_start_date, resolved_at, expires_at, last_keep_alive_notified_at, created_by_user_id, created_at";

export type StudentLite = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_initial: string | null;
  is_minor: boolean;
};

/** Perfil del estudiante de la sesión (o `null` si no existe / falló la lectura). */
export async function loadStudentByUserId(admin: SupabaseClient, userId: string): Promise<StudentLite | null> {
  const { data, error } = await admin
    .from("student_profiles")
    .select("id, user_id, first_name, last_initial, is_minor")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[stayChange] no se pudo leer el perfil del estudiante:", error);
    return null;
  }
  return (data as StudentLite | null) ?? null;
}

export async function loadIntent(admin: SupabaseClient, intentId: string): Promise<StayChangeIntentRow | null> {
  const { data, error } = await admin.from("stay_change_intents").select(INTENT_COLUMNS).eq("id", intentId).maybeSingle();
  if (error) {
    console.error("[stayChange] no se pudo leer el aviso:", error);
    return null;
  }
  return (data as unknown as StayChangeIntentRow | null) ?? null;
}

export const NOT_FOUND_ERROR = "No encontramos ese aviso de cambio.";
export const GENERIC_ERROR = "No pudimos completar la acción. Intentá de nuevo en unos minutos.";
