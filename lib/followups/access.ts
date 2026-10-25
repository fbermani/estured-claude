import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveFamilyUserIds } from "@/lib/stayChange/recipients";

export type FollowupRespondentRole = "student" | "guardian";

export type StudentFollowupView = {
  id: string;
  status: string;
  role: FollowupRespondentRole;
  residenceName: string | null;
  studentName: string | null;
  alreadyAnswered: boolean;
};

/**
 * Quién puede ver/responder la encuesta, con service role y chequeo EXPLÍCITO (la RLS de la migración 0055 es la segunda barrera):
 * el estudiante dueño, o el familiar vinculado activo SOLO si el estudiante es menor. Devuelve el rol con el que responde, o null.
 * La residencia, otro familiar y cualquier otro usuario → null.
 */
export async function resolveFollowupRole(
  admin: SupabaseClient,
  userId: string,
  followup: { student_profile_id: string | null },
): Promise<FollowupRespondentRole | null> {
  if (!followup.student_profile_id) return null;
  const { data: profile } = await admin
    .from("student_profiles")
    .select("user_id, is_minor")
    .eq("id", followup.student_profile_id)
    .maybeSingle();
  if (!profile) return null;
  if (profile.user_id === userId) return "student";
  if (profile.is_minor === true) {
    const guardians = await loadActiveFamilyUserIds(admin, followup.student_profile_id);
    if (guardians.includes(userId)) return "guardian";
  }
  return null;
}

/** Vista de la encuesta para quien le corresponde. `null` = sin acceso, inexistente o migración 0055 sin aplicar (`unavailable`). */
export async function loadStudentFollowup(
  admin: SupabaseClient,
  userId: string,
  followupId: string,
): Promise<{ kind: "ok"; view: StudentFollowupView } | { kind: "unavailable" } | { kind: "not_found" }> {
  const { data: followup, error } = await admin
    .from("stay_followups")
    .select("id, status, student_profile_id, residence_id")
    .eq("id", followupId)
    .maybeSingle();
  if (error) return { kind: error.code === "PGRST205" || error.code === "42P01" ? "unavailable" : "not_found" };
  if (!followup) return { kind: "not_found" };
  const role = await resolveFollowupRole(admin, userId, followup as { student_profile_id: string | null });
  if (!role) return { kind: "not_found" };
  const [{ data: residence }, { data: profile }, { data: mine }] = await Promise.all([
    admin.from("residences").select("name").eq("id", followup.residence_id).maybeSingle(),
    admin.from("student_profiles").select("first_name, last_initial").eq("id", followup.student_profile_id).maybeSingle(),
    admin.from("stay_followup_responses").select("id").eq("stay_followup_id", followupId).eq("respondent_role", role).maybeSingle(),
  ]);
  return {
    kind: "ok",
    view: {
      id: followup.id as string,
      status: followup.status as string,
      role,
      residenceName: (residence?.name as string) ?? null,
      studentName: profile?.first_name ? `${profile.first_name}${profile.last_initial ? ` ${profile.last_initial}.` : ""}` : null,
      alreadyAnswered: !!mine,
    },
  };
}
