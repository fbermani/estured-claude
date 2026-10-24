import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { checkReservationWindowOverlap } from "@/lib/students/reservationWindow";

export type JoinWaitlistResult = { ok: true; waitlistEntryId: string } | { ok: false; error: string };

/**
 * Docs/06 §10.2, §24.5, docs/08 §6.10 — lista de espera por residencia
 * (distinta de `waitlist_signups`, la pública pre-lanzamiento). No cuenta
 * como solicitud activa (docs/00 §9.1), así que no valida el límite de 2
 * solicitudes activas del estudiante.
 *
 * Ciclo 58: (a) la entrada duplicada se busca por estudiante+residencia+TIPO (el índice único de la
 * migración 0018 permite una por tipo; `roomTypeId = null` = "cualquier tipo" es su propia clave); (b) si
 * se elige un tipo, tiene que ser de ESTA residencia, estar activo y estar completo (no pausado, ni con
 * lugar: ahí se solicita directo); (c) con una reserva vigente no se puede anotar para fechas que se
 * superpongan con ella (`reservationWindow.ts`); sin fecha deseada se evalúa desde hoy.
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
  const { data: studentProfile, error: profileError } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (profileError) {
    console.error("[waitlist] joinWaitlist profile read failed:", profileError);
    return { ok: false, error: "No pudimos sumarte a la lista de espera. Intentá de nuevo." };
  }
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  const { data: residence, error: residenceError } = await admin
    .from("residences")
    .select("id, status")
    .eq("id", params.residenceId)
    .maybeSingle();
  if (residenceError) {
    console.error("[waitlist] joinWaitlist residence read failed:", residenceError);
    return { ok: false, error: "No pudimos sumarte a la lista de espera. Intentá de nuevo." };
  }
  if (!residence) return { ok: false, error: "No encontramos esa residencia." };

  if (params.roomTypeId) {
    const { data: roomType, error: roomTypeError } = await admin
      .from("room_types")
      .select("id, is_active, profile_availability(status)")
      .eq("id", params.roomTypeId)
      .eq("residence_id", params.residenceId)
      .maybeSingle();
    if (roomTypeError) {
      console.error("[waitlist] joinWaitlist room type read failed:", roomTypeError);
      return { ok: false, error: "No pudimos sumarte a la lista de espera. Intentá de nuevo." };
    }
    if (!roomType || !roomType.is_active) {
      return { ok: false, error: "Ese tipo de habitación ya no está disponible." };
    }
    // profile_availability tiene unique(room_type_id) — PostgREST devuelve un objeto singular en el embed.
    const availability = roomType.profile_availability as unknown as { status: string } | null;
    const state = typeAvailabilityState(availability?.status);
    if (state === "paused_by_residence" || state === "paused_by_admin") {
      return { ok: false, error: "Este tipo de habitación tiene las solicitudes pausadas. Probá más adelante o con otro tipo." };
    }
    if (state !== "full") {
      return { ok: false, error: "Este tipo de habitación no está completo: podés enviar una solicitud directamente." };
    }
  }

  const overlap = await checkReservationWindowOverlap(admin, {
    studentProfileId: studentProfile.id,
    desiredStartDate: params.desiredStartDate,
    durationMonths: params.desiredDurationMonths,
    residenceId: params.residenceId,
  });
  if (!overlap.ok) return { ok: false, error: overlap.error };

  let existingQuery = admin
    .from("waitlist_entries")
    .select("id")
    .eq("student_profile_id", studentProfile.id)
    .eq("residence_id", params.residenceId)
    .eq("status", "active");
  existingQuery = params.roomTypeId
    ? existingQuery.eq("room_type_id", params.roomTypeId)
    : existingQuery.is("room_type_id", null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) {
    console.error("[waitlist] joinWaitlist existing read failed:", existingError);
    return { ok: false, error: "No pudimos sumarte a la lista de espera. Intentá de nuevo." };
  }
  if (existing) {
    return {
      ok: false,
      error: params.roomTypeId
        ? "Ya estás en la lista de espera de este tipo de habitación."
        : "Ya estás en la lista de espera de esta residencia.",
    };
  }

  const { data: entry, error } = await admin
    .from("waitlist_entries")
    .insert({
      student_profile_id: studentProfile.id,
      residence_id: params.residenceId,
      room_type_id: params.roomTypeId,
      desired_start_date: params.desiredStartDate,
      desired_duration_months: params.desiredDurationMonths,
      // DR3: si se permitió por la excepción "Quiero cambiar", queda vinculada al aviso (se cierra si se cancela).
      ...(overlap.stayChangeIntentId ? { stay_change_intent_id: overlap.stayChangeIntentId } : {}),
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    // Carrera contra el índice único parcial (0018): otra solicitud simultánea ya lo anotó.
    return { ok: false, error: "Ya estás en la lista de espera de esta residencia." };
  }
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

  await notifyResidenceTeam(admin, { residenceId: params.residenceId, event: "new_waitlist_entry", entityId: entry.id });

  return { ok: true, waitlistEntryId: entry.id };
}
