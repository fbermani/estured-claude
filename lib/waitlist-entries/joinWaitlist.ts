import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type JoinWaitlistResult = { ok: true; waitlistEntryId: string } | { ok: false; error: string };

/**
 * Docs/06 §10.2, §24.5, docs/08 §6.10 — lista de espera por residencia
 * (distinta de `waitlist_signups`, la pública pre-lanzamiento). No cuenta
 * como solicitud activa (docs/00 §9.1), así que no valida el límite de 2
 * solicitudes activas del estudiante.
 */
export async function joinWaitlist(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    roomTypeId: string | null;
    desiredStartDate: string | null;
    desiredDurationMonths: number | null;
  },
): Promise<JoinWaitlistResult> {
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  const { data: residence } = await admin
    .from("residences")
    .select("id, status")
    .eq("id", params.residenceId)
    .maybeSingle();
  if (!residence) return { ok: false, error: "No encontramos esa residencia." };

  const { data: existing } = await admin
    .from("waitlist_entries")
    .select("id")
    .eq("student_profile_id", studentProfile.id)
    .eq("residence_id", params.residenceId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return { ok: false, error: "Ya estás en la lista de espera de esta residencia." };

  const { data: entry, error } = await admin
    .from("waitlist_entries")
    .insert({
      student_profile_id: studentProfile.id,
      residence_id: params.residenceId,
      room_type_id: params.roomTypeId,
      desired_start_date: params.desiredStartDate,
      desired_duration_months: params.desiredDurationMonths,
    })
    .select("id")
    .single();
  if (error || !entry) {
    console.error("[waitlist] joinWaitlist insert failed:", error);
    return { ok: false, error: "No pudimos sumarte a la lista de espera. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "waitlist_entry_joined",
    entityType: "waitlist_entries",
    entityId: entry.id,
    source: "user",
  });

  return { ok: true, waitlistEntryId: entry.id };
}
