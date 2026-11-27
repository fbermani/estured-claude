import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { loadActiveFamilyUserIds, loadResidenceUserIds } from "@/lib/stayChange/recipients";
import { isEmailProviderConfigured, sendEmail } from "@/lib/email/sendEmail";
import { emailButton, emailParagraph, escapeHtml, renderEmail } from "@/lib/email/layout";
import { SITE_URL } from "@/lib/siteUrl";
import type { AlertAudience, Copy } from "@/lib/applications/paymentDeadlineAlerts";

/**
 * Envío de las alertas del plazo de pago (DR74) y del plazo nuevo (DR73 (c)): app, push (categoría `requests_reservations`) y mail.
 * WhatsApp queda fuera (DR67 (a); `/terms` §24). El mail no sale sin clave de Resend. Nunca lanza.
 */

const RELATED = (applicationId: string) => ({
  relatedEntityType: "application_requests",
  relatedEntityId: applicationId,
  category: "requests_reservations" as const,
});

async function sendNoticeEmails(admin: SupabaseClient, userIds: string[], copy: Copy, applicationId: string): Promise<void> {
  if (userIds.length === 0 || !isEmailProviderConfigured()) return;
  try {
    const { data, error } = await admin.from("users").select("email").in("id", userIds);
    if (error) {
      console.error("[payment-deadline] email lookup failed:", error.code);
      return;
    }
    const html = renderEmail({
      preheader: copy.body,
      title: copy.title,
      hero: "cuenta",
      bodyHtml: emailParagraph(escapeHtml(copy.body)) + emailButton(`${SITE_URL}/students/applications/${applicationId}`, "Ver la solicitud"),
      footerNote: "Te llega este mail porque tenés una solicitud de reserva en EstuRed con un pago pendiente.",
    });
    for (const row of (data ?? []) as { email: string | null }[]) {
      if (row.email) await sendEmail({ to: row.email, subject: copy.title, html });
    }
  } catch (error) {
    console.error("[payment-deadline] email failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Aviso al estudiante y, si es menor, a su familiar vinculado (el que paga). `build` arma el texto según quién lee.
 * `true` si había al menos un destinatario (el job devuelve la marca si es `false`).
 */
export async function deliverStudentSideNotice(
  admin: SupabaseClient,
  params: { applicationId: string; studentProfileId: string; isMinor: boolean; build: (audience: AlertAudience) => Copy },
): Promise<boolean> {
  try {
    const { data } = await admin.from("student_profiles").select("user_id").eq("id", params.studentProfileId).maybeSingle();
    const studentUserId = (data?.user_id as string | undefined) ?? null;
    let sent = false;
    if (studentUserId) {
      const copy = params.build(params.isMinor ? "minor_student" : "student");
      await createNotification(admin, { userId: studentUserId, ...copy, ...RELATED(params.applicationId) });
      sent = true;
      await sendNoticeEmails(admin, [studentUserId], copy, params.applicationId);
    }
    if (params.isMinor) {
      const familyIds = (await loadActiveFamilyUserIds(admin, params.studentProfileId)).filter((id) => id !== studentUserId);
      const copy = params.build("family");
      for (const userId of familyIds) {
        await createNotification(admin, { userId, ...copy, ...RELATED(params.applicationId) });
        sent = true;
      }
      await sendNoticeEmails(admin, familyIds, copy, params.applicationId);
    }
    return sent;
  } catch (error) {
    console.error("[payment-deadline] student notice failed:", error);
    return false;
  }
}

/** Aviso al equipo de la residencia con permiso `payments.residence` (el dueño siempre). Solo app y push. */
export async function deliverResidenceNotice(admin: SupabaseClient, params: { applicationId: string; residenceId: string; copy: Copy }): Promise<boolean> {
  try {
    const userIds = await loadResidenceUserIds(admin, params.residenceId, "payments.residence");
    await Promise.all(userIds.map((userId) => createNotification(admin, { userId, ...params.copy, ...RELATED(params.applicationId) })));
    return userIds.length > 0;
  } catch (error) {
    console.error("[payment-deadline] residence notice failed:", error);
    return false;
  }
}
