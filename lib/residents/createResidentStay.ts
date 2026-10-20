import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";
import { findLinkableReservationIdByEmail } from "@/lib/residents/linkReservation";

export type CreateResidentStayResult = { ok: true; residentStayId: string } | { ok: false; error: string };

/**
 * Docs/05 §15.1 — "Residence owner o staff autorizado puede crear un
 * residente pendiente con email." Alta manual: la residencia carga un
 * futuro/actual residente por email; el estudiante lo activa después
 * (`activateResidentStay`) si ese email coincide con su cuenta.
 *
 * `reservationId` es opcional (docs/06 §15.1: `reservation_id` nullable)
 * — permite vincular el residente a una reserva real de EstuRed cuando
 * corresponde, pero no es obligatorio (la residencia puede cargar
 * residentes que llegaron por fuera de la plataforma). Si no viene y el
 * email corresponde a un estudiante con una única reserva confirmada en
 * ESTA residencia, se vincula automáticamente (ver `linkReservation.ts`).
 */
export async function createResidentStay(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    inviteEmail: string;
    roomTypeId: string | null;
    reservationId: string | null;
    startDate: string | null;
    /** "Contrato hasta" — opcional (migración 0025). */
    expectedEndDate?: string | null;
  },
): Promise<CreateResidentStayResult> {
  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, params.residenceId);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

  const email = params.inviteEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "Ingresá un email válido." };

  const { data: existing } = await admin
    .from("resident_stays")
    .select("id")
    .eq("residence_id", params.residenceId)
    .eq("invite_email", email)
    .eq("is_current", true)
    .maybeSingle();
  if (existing) return { ok: false, error: "Ya hay una estadía activa cargada con ese email en esta residencia." };

  let reservationId = params.reservationId;
  if (!reservationId) {
    try {
      reservationId = await findLinkableReservationIdByEmail(admin, { residenceId: params.residenceId, email });
    } catch (linkError) {
      console.error("[residents] createResidentStay auto-link failed:", linkError);
    }
  }

  const { data: stay, error } = await admin
    .from("resident_stays")
    .insert({
      residence_id: params.residenceId,
      room_type_id: params.roomTypeId,
      reservation_id: reservationId,
      created_by_residence_user_id: params.actorUserId,
      invite_email: email,
      status: "pending_activation",
      start_date: params.startDate,
      expected_end_date: params.expectedEndDate ?? null,
    })
    .select("id")
    .single();
  if (error || !stay) {
    console.error("[residents] createResidentStay insert failed:", error);
    return { ok: false, error: "No pudimos cargar el residente. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: "resident_stay_created",
    entityType: "resident_stays",
    entityId: stay.id,
    newValue: { residence_id: params.residenceId, invite_email: email },
  });

  return { ok: true, residentStayId: stay.id };
}
