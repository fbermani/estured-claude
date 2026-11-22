import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { sendEmail } from "@/lib/email/sendEmail";
import { formatDateTime } from "@/lib/dates/format";
import { getAppUrl } from "@/lib/appUrl";
import { escapeHtml } from "@/lib/team/teamCopy";

/**
 * Avisa a TODOS los superadmin activos que cambiaron los medios de cobro del fee (DR64 (a); `docs/07` §17.6): notificación in-app con
 * enlace y email. Ni la notificación ni el email llevan datos de cobro: solo QUÉ cambió, para que un cambio inesperado (cuenta de cobro
 * alterada) se note enseguida. Es la mitigación de no pedir la aprobación de un segundo admin. Nunca lanza: un aviso que falla no
 * revierte el guardado (que ya se auditó). Mismo precedente que `notifySuperadminsOfPaymentSettingsChange`.
 */
export async function notifySuperadminsOfFeeCollectionChange(
  admin: SupabaseClient,
  params: { entityId: string | null; changes: string[] },
): Promise<void> {
  try {
    if (params.changes.length === 0) return;
    const { data: roleRows } = await admin.from("user_roles").select("user_id").eq("role", "superadmin").eq("is_active", true);
    const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id as string))];
    if (userIds.length === 0) return;
    const { data: users } = await admin.from("users").select("id, email, is_active, is_blocked").in("id", userIds);
    const recipients = (users ?? []).filter((u) => u.is_active && !u.is_blocked);

    const what = params.changes.join(" ");
    const appUrl = getAppUrl();
    const when = formatDateTime(new Date());
    await Promise.all(
      recipients.flatMap((u) => [
        createNotification(admin, {
          userId: u.id,
          title: "Cambiaron los medios de cobro del fee",
          body: `${what} Si no lo esperabas, revisalo en Pagos → Datos de cobro.`,
          relatedEntityType: "payment_settings",
          relatedEntityId: params.entityId ?? undefined,
          category: "admin_requests",
        }),
        sendEmail({
          to: u.email,
          subject: "EstuRed: cambiaron los medios de cobro del fee",
          html: `
            <p>Hola,</p>
            <p>${escapeHtml(what)} (${when}, hora de Buenos Aires).</p>
            <p>Si no lo esperabas, entrá a <a href="${appUrl}/admin/payment-settings">Datos de cobro</a> y revisalo.</p>
          `,
        }),
      ]),
    );
  } catch (error) {
    console.error("[fee-collection] notify failed:", error);
  }
}
