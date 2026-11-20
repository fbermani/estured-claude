import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import type { NotificationCategory } from "@/lib/notifications/categories";
import { formatDateTime } from "@/lib/dates/format";

/**
 * Avisos al ESTUDIANTE (usuario de `student_profiles.user_id`) de los hitos de su solicitud, su reserva y sus renovaciones (DR61).
 * Si el estudiante es menor y tiene familiar, el aviso igual le llega al estudiante (el familiar tiene sus propios avisos en
 * `familyMilestones`). Nunca lanzan: un aviso que falla no puede tumbar la acción de negocio. Copy en segunda persona, sin prometer
 * disponibilidad ("sujeta a confirmación").
 */

export type StudentNotificationEntry = {
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  category?: NotificationCategory;
};

/** Notifica al usuario dueño del perfil de estudiante. Nunca lanza. */
export async function notifyStudentByProfileId(
  admin: SupabaseClient,
  studentProfileId: string | null | undefined,
  entry: StudentNotificationEntry,
): Promise<void> {
  if (!studentProfileId) return;
  try {
    const { data } = await admin.from("student_profiles").select("user_id").eq("id", studentProfileId).maybeSingle();
    const userId = data?.user_id as string | undefined;
    if (!userId) return;
    await createNotification(admin, { userId, ...entry });
  } catch (error) {
    console.error("[notifications] notifyStudentByProfileId failed:", error);
  }
}

export type StudentApplicationMilestone = "accepted" | "payment_enabled" | "adjustment_proposed";

/** Hitos de la SOLICITUD para el estudiante: contacto establecido, pago a la residencia habilitado y propuesta de ajuste recibida. */
export async function notifyStudentApplicationMilestone(
  admin: SupabaseClient,
  applicationId: string,
  milestone: StudentApplicationMilestone,
): Promise<void> {
  try {
    const { data } = await admin
      .from("application_requests")
      .select("student_profile_id, residences(name)")
      .eq("id", applicationId)
      .maybeSingle();
    if (!data?.student_profile_id) return;
    const residenceName = (data.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    const copy: Record<StudentApplicationMilestone, { title: string; body: string }> = {
      accepted: {
        title: `${residenceName} aceptó tu solicitud`,
        body: "La residencia estableció contacto. Todavía falta confirmar las condiciones y el pago: la solicitud sigue sujeta a confirmación.",
      },
      payment_enabled: {
        title: `Ya podés pagar la reserva en ${residenceName}`,
        body: "La residencia habilitó el pago. Se paga directamente a la residencia, dentro del plazo informado, y después se abona el fee EstuRed.",
      },
      adjustment_proposed: {
        title: `${residenceName} te propuso un ajuste`,
        body: "Revisá las condiciones propuestas y respondé dentro del plazo. Si no respondés a tiempo, la solicitud vence.",
      },
    };
    await notifyStudentByProfileId(admin, data.student_profile_id as string, {
      ...copy[milestone],
      relatedEntityType: "application_requests",
      relatedEntityId: applicationId,
      category: "requests_reservations",
    });
  } catch (error) {
    console.error("[notifications] notifyStudentApplicationMilestone failed:", error);
  }
}

export type StudentReservationMilestone = "fee_to_pay" | "confirmed";

/** Hitos de la RESERVA para el estudiante: fee pendiente con su plazo y reserva confirmada con comprobante. */
export async function notifyStudentReservationMilestone(
  admin: SupabaseClient,
  reservationId: string,
  milestone: StudentReservationMilestone,
): Promise<void> {
  try {
    const { data } = await admin
      .from("reservations")
      .select("student_profile_id, estured_fee_payment_id, residences(name)")
      .eq("id", reservationId)
      .maybeSingle();
    if (!data?.student_profile_id) return;
    const residenceName = (data.residences as unknown as { name: string } | null)?.name ?? "la residencia";

    if (milestone === "confirmed") {
      await notifyStudentByProfileId(admin, data.student_profile_id as string, {
        title: "Tu reserva está confirmada",
        body: `Se confirmó tu reserva en ${residenceName} y ya está disponible el comprobante de reserva.`,
        relatedEntityType: "reservations",
        relatedEntityId: reservationId,
        category: "requests_reservations",
      });
      return;
    }

    let deadline = "";
    if (data.estured_fee_payment_id) {
      const { data: fee } = await admin
        .from("estured_fee_payments")
        .select("expires_at")
        .eq("id", data.estured_fee_payment_id as string)
        .maybeSingle();
      if (fee?.expires_at) deadline = ` Plazo: hasta el ${formatDateTime(fee.expires_at as string)}.`;
    }
    await notifyStudentByProfileId(admin, data.student_profile_id as string, {
      title: "Te falta abonar el fee EstuRed",
      body: `${residenceName} informó que recibió el pago de la reserva. Falta abonar el fee EstuRed.${deadline} Si no se paga a tiempo, la reserva vence.`,
      relatedEntityType: "reservations",
      relatedEntityId: reservationId,
      category: "payments_fee",
    });
  } catch (error) {
    console.error("[notifications] notifyStudentReservationMilestone failed:", error);
  }
}

/** Oferta de renovación enviada por la residencia: aviso al estudiante. */
export async function notifyStudentRenewalOfferSent(admin: SupabaseClient, renewalOfferId: string): Promise<void> {
  try {
    const { data } = await admin
      .from("renewal_offers")
      .select("student_profile_id, acceptance_deadline_at, residences(name)")
      .eq("id", renewalOfferId)
      .maybeSingle();
    if (!data?.student_profile_id) return;
    const residenceName = (data.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    const deadline = data.acceptance_deadline_at ? ` Respondé hasta el ${formatDateTime(data.acceptance_deadline_at as string)}.` : "";
    await notifyStudentByProfileId(admin, data.student_profile_id as string, {
      title: `${residenceName} te envió una oferta de renovación`,
      body: `Revisá las condiciones del nuevo período.${deadline} La renovación queda sujeta a confirmación.`,
      relatedEntityType: "renewal_offers",
      relatedEntityId: renewalOfferId,
      category: "requests_reservations",
    });
  } catch (error) {
    console.error("[notifications] notifyStudentRenewalOfferSent failed:", error);
  }
}
