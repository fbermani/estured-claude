import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { sendEmail } from "@/lib/email/sendEmail";
import { formatDateTime } from "@/lib/dates/format";
import { getAppUrl } from "@/lib/appUrl";

/** Rótulos de los campos de `payment_settings`, para decir qué cambió sin mostrar los valores. */
const FIELD_LABELS: Record<string, string> = {
  account_holder: "titular",
  alias: "alias",
  cbu: "CBU",
  bank_name: "banco",
  holder_cuit: "CUIT/CUIL",
  instructions: "indicaciones",
};

/** Campos que cambiaron entre dos versiones (claves de la tabla). `before = null` = primera carga. */
export function changedPaymentSettingsFields(
  before: Record<string, string | null> | null,
  after: Record<string, string | null>,
): string[] {
  return Object.keys(FIELD_LABELS).filter((key) => !before || (before[key] ?? null) !== (after[key] ?? null));
}

/**
 * Avisa a TODOS los superadmin activos que cambiaron los datos de cobro del
 * fee (D2): notificación in-app con enlace y email. Ni el email ni la
 * notificación llevan CBU, alias ni titular — solo qué campos cambiaron, para
 * que un cambio inesperado (cuenta de cobro alterada) se note enseguida.
 * Nunca lanza: un aviso que falla no revierte el guardado (que ya se auditó).
 */
export async function notifySuperadminsOfPaymentSettingsChange(
  admin: SupabaseClient,
  params: { settingsId: string | null; changedFields: string[]; isFirstLoad: boolean },
): Promise<void> {
  try {
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "superadmin")
      .eq("is_active", true);
    const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id as string))];
    if (userIds.length === 0) return;

    const { data: users } = await admin
      .from("users")
      .select("id, email, is_active, is_blocked")
      .in("id", userIds);
    const recipients = (users ?? []).filter((u) => u.is_active && !u.is_blocked);

    const labels = params.changedFields.map((f) => FIELD_LABELS[f] ?? f);
    const what = params.isFirstLoad ? "se cargaron por primera vez" : `se modificaron (${labels.join(", ") || "sin cambios de valor"})`;
    const appUrl = getAppUrl();
    const when = formatDateTime(new Date());

    await Promise.all(
      recipients.flatMap((u) => [
        createNotification(admin, {
          userId: u.id,
          title: "Cambiaron los datos de cobro del fee",
          body: `Los datos de cobro ${what}. Si no lo esperabas, revisalo en Pagos → Datos de cobro.`,
          relatedEntityType: "payment_settings",
          relatedEntityId: params.settingsId ?? undefined,
          category: "admin_requests",
        }),
        sendEmail({
          to: u.email,
          subject: "EstuRed: cambiaron los datos de cobro del fee",
          html: `
            <p>Hola,</p>
            <p>Los datos de cobro del fee EstuRed ${what} (${when}, hora de Buenos Aires).</p>
            <p>Si no lo esperabas, entrá a <a href="${appUrl}/admin/payment-settings">Datos de cobro</a> y revisalo.</p>
          `,
        }),
      ]),
    );
  } catch (error) {
    console.error("[payment-settings] notify failed:", error);
  }
}
