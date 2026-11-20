import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFollowupRole } from "@/lib/followups/access";

/**
 * Encuesta de seguimiento pendiente (estado `sent`) que `userId` puede responder para `studentProfileId`.
 * Devuelve `null` si no hay, si ya respondió, si no le corresponde (la residencia y otros familiares nunca) o si falta la migración 0055.
 * Es solo el acceso desde «Mi residencia»: la autorización real sigue en `loadStudentFollowup`.
 */
export async function loadPendingFollowupForUser(
  admin: SupabaseClient,
  userId: string,
  studentProfileId: string,
): Promise<{ id: string; role: "student" | "guardian" } | null> {
  const { data: followup, error } = await admin
    .from("stay_followups")
    .select("id, student_profile_id")
    .eq("student_profile_id", studentProfileId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !followup) return null;
  const role = await resolveFollowupRole(admin, userId, followup as { student_profile_id: string | null });
  if (!role) return null;
  const { data: mine } = await admin
    .from("stay_followup_responses")
    .select("id")
    .eq("stay_followup_id", followup.id)
    .eq("respondent_role", role)
    .maybeSingle();
  if (mine) return null;
  return { id: followup.id as string, role };
}
