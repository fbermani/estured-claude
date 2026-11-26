import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import type { NotificationCategory } from "@/lib/notifications/categories";
import { notifyLinkedFamily, loadStudentShortName } from "@/lib/family/notifyLinkedFamily";
import { formatDateTime } from "@/lib/dates/format";

/**
 * Avisos al familiar vinculado de los HITOS clave y de los pagos del estudiante (DR4, docs/00 §31; docs/06 §21.1).
 * Cada función es el ÚNICO punto de aviso de su hito (un solo helper, `notifyLinkedFamily`), así que los call sites son
 * una línea y no se duplican. Nunca lanzan. Copy en tercera persona, sin prometer disponibilidad ("sujeta a
 * confirmación"). Nada de mensajes privados ni de movimientos menores (en revisión, mensajes, ediciones).
 */

type AppContext = { studentProfileId: string; residenceName: string; studentName: string };

async function loadApplicationContext(admin: SupabaseClient, applicationId: string): Promise<AppContext | null> {
  const { data } = await admin
    .from("application_requests")
    .select("student_profile_id, residences(name)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!data?.student_profile_id) return null;
  return {
    studentProfileId: data.student_profile_id as string,
    residenceName: (data.residences as unknown as { name: string } | null)?.name ?? "la residencia",
    studentName: await loadStudentShortName(admin, data.student_profile_id as string),
  };
}

const APPLICATION_CATEGORY: Record<string, NotificationCategory> = {
  accepted: "requests_reservations",
  payment_requested: "requests_reservations",
  expired_no_response: "deadlines",
  expired_no_payment: "deadlines",
};

const RESERVATION_CATEGORY: Record<string, NotificationCategory> = {
  fee_to_pay: "payments_fee",
  confirmed: "requests_reservations",
  fee_expired: "deadlines",
};

export type ApplicationMilestone = "accepted" | "payment_requested" | "expired_no_response" | "expired_no_payment";

/** Hitos de la SOLICITUD: aceptada (contacto establecido), pago a la residencia pedido y vencimientos. */
export async function notifyFamilyApplicationMilestone(
  admin: SupabaseClient,
  applicationId: string,
  milestone: ApplicationMilestone,
): Promise<void> {
  try {
    const ctx = await loadApplicationContext(admin, applicationId);
    if (!ctx) return;
    const { studentName, residenceName } = ctx;
    const copy: Record<ApplicationMilestone, { title: string; body: string }> = {
      accepted: {
        title: `${residenceName} aceptó la solicitud de ${studentName}`,
        body: `La residencia estableció contacto. Todavía faltan confirmar las condiciones y el pago: la solicitud sigue sujeta a confirmación.`,
      },
      payment_requested: {
        title: `Pago a ${residenceName} pedido para ${studentName}`,
        body: `La residencia habilitó el pago de la reserva. Se paga directamente a la residencia, dentro del plazo informado, y después se abona el fee EstuRed.`,
      },
      expired_no_response: {
        title: `La solicitud de ${studentName} a ${residenceName} venció`,
        body: `La residencia no respondió a tiempo. ${studentName} puede enviar otra solicitud cuando quiera.`,
      },
      expired_no_payment: {
        title: `La solicitud de ${studentName} a ${residenceName} venció sin pago`,
        body: `No se registró el pago a la residencia dentro del plazo de 48 h. ${studentName} puede volver a enviar su solicitud de reserva; la disponibilidad se confirma con la residencia.`,
      },
    };
    await notifyLinkedFamily(admin, ctx.studentProfileId, {
      ...copy[milestone],
      relatedEntityType: "application_requests",
      relatedEntityId: applicationId,
      category: APPLICATION_CATEGORY[milestone],
    });
  } catch (error) {
    console.error("[family] notifyFamilyApplicationMilestone failed:", error);
  }
}

export type ReservationMilestone = "fee_to_pay" | "confirmed" | "fee_expired";

/**
 * Hitos de la RESERVA: fee a pagar y su plazo, reserva confirmada (con su comprobante) y fee vencido.
 * `excludeUserIds`: quien ya recibió un aviso propio por otra vía (p. ej. el pagador reabierto).
 */
export async function notifyFamilyReservationMilestone(
  admin: SupabaseClient,
  reservationId: string,
  milestone: ReservationMilestone,
  options: { excludeUserIds?: string[] } = {},
): Promise<void> {
  try {
    const { data: reservation } = await admin
      .from("reservations")
      .select("id, student_profile_id, estured_fee_payment_id, residences(name)")
      .eq("id", reservationId)
      .maybeSingle();
    if (!reservation?.student_profile_id) return;
    const studentName = await loadStudentShortName(admin, reservation.student_profile_id as string);
    const residenceName = (reservation.residences as unknown as { name: string } | null)?.name ?? "la residencia";

    let deadline = "";
    if (milestone === "fee_to_pay" && reservation.estured_fee_payment_id) {
      const { data: fee } = await admin
        .from("estured_fee_payments")
        .select("expires_at")
        .eq("id", reservation.estured_fee_payment_id)
        .maybeSingle();
      if (fee?.expires_at) deadline = ` Plazo: hasta el ${formatDateTime(fee.expires_at as string)}.`;
    }

    const copy: Record<ReservationMilestone, { title: string; body: string }> = {
      fee_to_pay: {
        title: `Fee EstuRed a pagar — reserva de ${studentName}`,
        body: `${residenceName} informó que recibió el pago de la reserva. Falta abonar el fee EstuRed.${deadline} Si no se paga a tiempo, la reserva vence.`,
      },
      confirmed: {
        title: `Reserva confirmada para ${studentName}`,
        body: `Se confirmó la reserva de ${studentName} en ${residenceName} y ya está disponible el comprobante de reserva.`,
      },
      fee_expired: {
        title: `Venció el plazo del fee de ${studentName}`,
        body: `El fee EstuRed de la reserva en ${residenceName} no se pagó a tiempo y la reserva venció. Escribinos desde Soporte si necesitás ayuda.`,
      },
    };
    await notifyLinkedFamily(
      admin,
      reservation.student_profile_id as string,
      { ...copy[milestone], relatedEntityType: "reservations", relatedEntityId: reservationId, category: RESERVATION_CATEGORY[milestone] },
      options,
    );
  } catch (error) {
    console.error("[family] notifyFamilyReservationMilestone failed:", error);
  }
}

export type ProposalMilestone = "approved" | "rejected" | "expired";

/** Respuesta del estudiante a una propuesta del familiar (DR4: aprobada, rechazada) o su vencimiento. Va al familiar AUTOR. */
export async function notifyFamilyProposalOutcome(
  admin: SupabaseClient,
  proposalId: string,
  outcome: ProposalMilestone,
): Promise<void> {
  try {
    const { data } = await admin
      .from("family_application_proposals")
      .select("id, student_profile_id, converted_to_application_id, residences(name), family_members(user_id)")
      .eq("id", proposalId)
      .maybeSingle();
    const familyUserId = (data?.family_members as unknown as { user_id: string } | null)?.user_id;
    if (!data || !familyUserId) return;
    const studentName = await loadStudentShortName(admin, data.student_profile_id as string);
    const residenceName = (data.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    const copy: Record<ProposalMilestone, { title: string; body: string }> = {
      approved: {
        title: `${studentName} aprobó tu propuesta`,
        body: `Se envió la solicitud a ${residenceName}. Está sujeta a confirmación de la residencia: vas a ver cómo avanza en tu inicio.`,
      },
      rejected: {
        title: `${studentName} rechazó tu propuesta`,
        body: `La propuesta de ${residenceName} no avanzó. Podés proponerle otra residencia cuando quieras.`,
      },
      expired: {
        title: `Venció tu propuesta de ${residenceName}`,
        body: `${studentName} no respondió dentro del plazo. Podés volver a proponérsela.`,
      },
    };
    await createNotification(admin, {
      userId: familyUserId,
      category: "requests_reservations",
      ...copy[outcome],
      relatedEntityType: outcome === "approved" && data.converted_to_application_id ? "application_requests" : "family_application_proposals",
      relatedEntityId: outcome === "approved" && data.converted_to_application_id ? (data.converted_to_application_id as string) : proposalId,
    });
  } catch (error) {
    console.error("[family] notifyFamilyProposalOutcome failed:", error);
  }
}
