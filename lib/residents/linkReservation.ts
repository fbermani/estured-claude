import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Vínculo `resident_stays.reservation_id` (migración 0019; backfill en
 * 0035). La columna existe desde la Fase 5.3 pero ningún flujo real la
 * poblaba (solo los seeds) — sin ella la residencia no puede saber qué
 * reserva/oferta de renovación corresponde a cada residente.
 *
 * Regla de vínculo (supuesto reversible, ver MEMORY.md Ciclo 42): una
 * estadía se vincula a la reserva `confirmed` del MISMO estudiante en la
 * MISMA residencia, solo si esa reserva es única y ninguna otra estadía
 * actual ya la referencia. Ante cualquier ambigüedad (0 o 2+ reservas
 * confirmadas, reserva ya tomada) no se vincula nada: un vínculo
 * equivocado haría ofrecer renovación sobre la reserva incorrecta, uno
 * faltante solo deja la estadía "sin reserva" (estado ya soportado).
 */
export async function findLinkableReservationId(
  admin: SupabaseClient,
  params: { residenceId: string; studentProfileId: string },
): Promise<string | null> {
  const { data: reservations, error } = await admin
    .from("reservations")
    .select("id")
    .eq("residence_id", params.residenceId)
    .eq("student_profile_id", params.studentProfileId)
    .eq("status", "confirmed");
  if (error || !reservations || reservations.length !== 1) return null;

  const reservationId = reservations[0].id as string;
  const { data: taken } = await admin
    .from("resident_stays")
    .select("id")
    .eq("reservation_id", reservationId)
    .eq("is_current", true)
    .limit(1);
  if (taken && taken.length > 0) return null;
  return reservationId;
}

/**
 * Resuelve la reserva vinculable a partir del email con el que la
 * residencia dio de alta al residente (todavía sin `student_profile_id`).
 * Solo mira reservas de ESA residencia — no expone nada de otras.
 */
export async function findLinkableReservationIdByEmail(
  admin: SupabaseClient,
  params: { residenceId: string; email: string },
): Promise<string | null> {
  const { data: user } = await admin.from("users").select("id").eq("email", params.email.toLowerCase()).maybeSingle();
  if (!user) return null;
  const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) return null;
  return findLinkableReservationId(admin, { residenceId: params.residenceId, studentProfileId: profile.id });
}

/**
 * Vincula una estadía existente (p. ej. al activarse la cuenta del
 * estudiante). Solo completa si `reservation_id` está vacío; nunca pisa un
 * vínculo previo y nunca lanza — mismo criterio que
 * `extendResidentStayOnRenewal` (un fallo acá no debe romper la
 * operación principal).
 */
export async function linkStayToReservationIfMissing(
  admin: SupabaseClient,
  params: { residentStayId: string; residenceId: string; studentProfileId: string },
): Promise<string | null> {
  try {
    const reservationId = await findLinkableReservationId(admin, params);
    if (!reservationId) return null;
    const { data, error } = await admin
      .from("resident_stays")
      .update({ reservation_id: reservationId })
      .eq("id", params.residentStayId)
      .is("reservation_id", null)
      .select("id");
    if (error || !data || data.length === 0) return null;
    return reservationId;
  } catch (error) {
    console.error("[residents] linkStayToReservationIfMissing failed:", error);
    return null;
  }
}
