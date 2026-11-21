import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyStudentByProfileId } from "@/lib/notifications/notifyStudent";
import { loadStudentShortName, notifyLinkedFamily } from "@/lib/family/notifyLinkedFamily";
import { loadResidenceUserIds } from "@/lib/stayChange/recipients";

/**
 * Avisos del aviso del estudiante sobre el pago de la reserva (DR63 (e), (f), (l)). In-app (y push de `requests_reservations`, con texto
 * genérico). NUNCA llevan datos de cobro, montos ni el motivo escrito por el estudiante o la residencia; no prometen disponibilidad.
 * Ningún emisor lanza: un aviso que falla no puede tumbar la acción de negocio.
 */

const RELATED = (applicationId: string) => ({
  relatedEntityType: "application_requests",
  relatedEntityId: applicationId,
  category: "requests_reservations" as const,
});

export type ResidenceNoticeKind = "student_reported_paid" | "student_payment_issue" | "reminder_reported_paid" | "reminder_payment_issue";

const RESIDENCE_COPY: Record<ResidenceNoticeKind, (isMinor: boolean) => { title: string; body: string }> = {
  student_reported_paid: () => ({
    title: "El estudiante avisó que pagó",
    body: "Revisá que el pago esté en tu cuenta y confirmalo en la solicitud. Si no lo recibiste, también lo registrás ahí.",
  }),
  student_payment_issue: (isMinor) => ({
    title: "El estudiante no pudo realizar el pago",
    body: isMinor
      ? "Es menor: contactá a su familiar vinculado por WhatsApp, o volvé a habilitar el pago desde la solicitud."
      : "Contactalo por WhatsApp, o volvé a habilitar el pago desde la solicitud.",
  }),
  reminder_reported_paid: () => ({
    title: "Tenés un pago por confirmar",
    body: "Un estudiante avisó hace más de 24 horas que pagó y todavía no respondiste. Confirmalo o registrá que no lo recibiste.",
  }),
  reminder_payment_issue: () => ({
    title: "Un estudiante espera tu respuesta",
    body: "Avisó hace más de 24 horas que no pudo pagar. Contactalo o volvé a habilitar el pago desde la solicitud.",
  }),
};

/**
 * Aviso al equipo de la residencia con permiso `payments.residence` (el dueño siempre). Devuelve `true` si el aviso salió a al menos un
 * destinatario; `false` si falló o no había a quién avisar. Los llamadores que reclaman una marca antes de avisar (el job de
 * recordatorios) la devuelven cuando el resultado es `false`; el resto lo ignora (un aviso que no sale nunca tumba la acción).
 */
export async function notifyResidencePaymentTeam(
  admin: SupabaseClient,
  params: { applicationId: string; residenceId: string; kind: ResidenceNoticeKind; isMinor: boolean },
): Promise<boolean> {
  try {
    const userIds = await loadResidenceUserIds(admin, params.residenceId, "payments.residence");
    const copy = RESIDENCE_COPY[params.kind](params.isMinor);
    await Promise.all(userIds.map((userId) => createNotification(admin, { userId, ...copy, ...RELATED(params.applicationId) })));
    return userIds.length > 0;
  } catch (error) {
    console.error("[notifications] notifyResidencePaymentTeam failed:", error);
    return false;
  }
}

/** Aviso a la otra parte cuando el estudiante es menor: el estudiante avisó → familiar; el familiar avisó → estudiante. */
export async function notifyPaymentCounterpart(
  admin: SupabaseClient,
  params: { applicationId: string; studentProfileId: string; actorRole: "student" | "family_payer"; kind: "paid" | "issue" },
): Promise<void> {
  try {
    const verb = params.kind === "paid" ? "avisó que pagó la reserva" : "avisó que no pudo pagar la reserva";
    const title = params.kind === "paid" ? "Se avisó el pago de la reserva" : "Se avisó un problema con el pago";
    if (params.actorRole === "student") {
      const name = await loadStudentShortName(admin, params.studentProfileId);
      await notifyLinkedFamily(admin, params.studentProfileId, {
        title,
        body: `${name} ${verb}. La residencia lo tiene que confirmar. La solicitud sigue sujeta a confirmación.`,
        ...RELATED(params.applicationId),
      });
    } else {
      await notifyStudentByProfileId(admin, params.studentProfileId, {
        title,
        body: `Tu familiar ${verb}. La residencia lo tiene que confirmar. La solicitud sigue sujeta a confirmación.`,
        ...RELATED(params.applicationId),
      });
    }
  } catch (error) {
    console.error("[notifications] notifyPaymentCounterpart failed:", error);
  }
}

/** Aviso al estudiante (y a su familiar, si es menor) con un texto ya armado. */
export async function notifyStudentAndFamily(
  admin: SupabaseClient,
  params: { applicationId: string; studentProfileId: string; student: { title: string; body: string }; family?: { title: string; body: string } | null },
): Promise<void> {
  await notifyStudentByProfileId(admin, params.studentProfileId, { ...params.student, ...RELATED(params.applicationId) });
  if (params.family) await notifyLinkedFamily(admin, params.studentProfileId, { ...params.family, ...RELATED(params.applicationId) });
}
