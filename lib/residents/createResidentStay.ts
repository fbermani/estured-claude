import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { normalizeResidentName, normalizeResidentPhone } from "@/lib/residents/identity";
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
    /** Opcional (DR18 t4): sin mail se carga con `inviteName` y queda «sin activar» hasta que se le cargue un mail. */
    inviteEmail: string | null;
    inviteName?: string | null;
    /** Teléfono opcional, solo para el mensaje manual de registro por WhatsApp. */
    invitePhone?: string | null;
    roomTypeId: string | null;
    reservationId: string | null;
    startDate: string | null;
    /** "Contrato hasta" — opcional (migración 0025). */
    expectedEndDate?: string | null;
  },
): Promise<CreateResidentStayResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  const email = (params.inviteEmail ?? "").trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Ingresá un email válido." };
  const name = normalizeResidentName(params.inviteName);
  if (!email && !name) return { ok: false, error: "Cargá el email del residente o, si todavía no lo tenés, su nombre y apellido." };
  if (params.inviteName && String(params.inviteName).trim() && !name) return { ok: false, error: "El nombre tiene que tener entre 2 y 80 caracteres." };
  const phone = normalizeResidentPhone(params.invitePhone);
  if (params.invitePhone && String(params.invitePhone).trim() && !phone) {
    return { ok: false, error: "El teléfono tiene que tener entre 8 y 15 dígitos, con código de país (por ejemplo 5491112345678)." };
  }

  // IDOR: `roomTypeId` y `reservationId` pueden venir de un formulario. Tienen que ser de ESTA residencia: un tipo de habitación ajeno
  // dejaría una estadía "ficticia" apuntando a otra residencia (y, al cerrarla, tocaría su disponibilidad).
  if (params.roomTypeId) {
    const { data: ownType, error: typeError } = await admin
      .from("room_types")
      .select("id")
      .eq("id", params.roomTypeId)
      .eq("residence_id", params.residenceId)
      .maybeSingle();
    if (typeError) {
      console.error("[residents] createResidentStay room type read failed:", typeError);
      return { ok: false, error: "No pudimos cargar el residente. Intentá de nuevo." };
    }
    if (!ownType) return { ok: false, error: "Ese tipo de habitación no pertenece a esta residencia." };
  }
  if (params.reservationId) {
    const { data: ownReservation, error: reservationError } = await admin
      .from("reservations")
      .select("id")
      .eq("id", params.reservationId)
      .eq("residence_id", params.residenceId)
      .maybeSingle();
    if (reservationError) {
      console.error("[residents] createResidentStay reservation read failed:", reservationError);
      return { ok: false, error: "No pudimos cargar el residente. Intentá de nuevo." };
    }
    if (!ownReservation) return { ok: false, error: "Esa reserva no pertenece a esta residencia." };
  }

  if (email) {
    const { data: existing } = await admin
      .from("resident_stays")
      .select("id")
      .eq("residence_id", params.residenceId)
      .eq("invite_email", email)
      .eq("is_current", true)
      .maybeSingle();
    if (existing) return { ok: false, error: "Ya hay una estadía activa cargada con ese email en esta residencia." };
  } else if (name) {
    // Sin mail la unicidad es por nombre dentro de la residencia (también la garantiza un índice único parcial de la 0063).
    const { data: sameName, error: nameError } = await admin
      .from("resident_stays")
      .select("id")
      .eq("residence_id", params.residenceId)
      .eq("is_current", true)
      .is("invite_email", null)
      .is("student_profile_id", null)
      .ilike("invite_name", name.replace(/[%_\\]/g, (c) => `\\${c}`));
    if (nameError && !isMissingSchemaError(nameError)) {
      console.error("[residents] createResidentStay name check failed:", nameError);
      return { ok: false, error: "No pudimos cargar el residente. Intentá de nuevo." };
    }
    if (sameName && sameName.length > 0) return { ok: false, error: "Ya cargaste un residente sin mail con ese nombre. Cargale el mail o usá otro nombre." };
  }

  let reservationId = params.reservationId;
  if (!reservationId && email) {
    try {
      reservationId = await findLinkableReservationIdByEmail(admin, { residenceId: params.residenceId, email });
    } catch (linkError) {
      console.error("[residents] createResidentStay auto-link failed:", linkError);
    }
  }

  const baseRow = {
    residence_id: params.residenceId,
    room_type_id: params.roomTypeId,
    reservation_id: reservationId,
    created_by_residence_user_id: params.actorUserId,
    invite_email: email,
    status: "pending_activation",
    start_date: params.startDate,
    expected_end_date: params.expectedEndDate ?? null,
  };
  let { data: stay, error } = await admin
    .from("resident_stays")
    .insert({ ...baseRow, ...(name || phone ? { invite_name: name, invite_phone: phone } : {}) })
    .select("id")
    .single();
  // Con mail y sin la 0063, se reintenta sin invite_* para no romper lo que antes funcionaba.
  if (error && isMissingSchemaError(error) && email) {
    ({ data: stay, error } = await admin.from("resident_stays").insert(baseRow).select("id").single());
  }
  if (error && isMissingSchemaError(error) && !email) {
    return { ok: false, error: "Cargar residentes sin mail todavía no está disponible en este entorno. Cargalo con su email por ahora." };
  }
  if (error?.code === "23505" && !email) {
    return { ok: false, error: "Ya cargaste un residente sin mail con ese nombre. Cargale el mail o usá otro nombre." };
  }
  if (error || !stay) {
    console.error("[residents] createResidentStay insert failed:", error);
    return { ok: false, error: "No pudimos cargar el residente. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "resident_stay_created",
    entityType: "resident_stays",
    entityId: stay.id,
    // PII mínima: el log guarda solo qué datos se cargaron (no el nombre ni el teléfono).
    newValue: { permission: access.permission, residence_id: params.residenceId, has_email: Boolean(email), has_name: Boolean(name), has_phone: Boolean(phone) },
  });

  return { ok: true, residentStayId: stay.id };
}
