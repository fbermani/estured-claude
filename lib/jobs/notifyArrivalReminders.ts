import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIso } from "@/lib/applications/reservationMoney";
import { daysUntil } from "@/lib/arrival/countdown";
import { buildReminderCopy } from "@/lib/arrival/reminderCopy";
import {
  REMINDER_RESERVATION_STATUSES,
  isDuplicateSend,
  isMissingSendsTable,
  isReminderHour,
  recipientGetsReminder,
  reminderKeyForDays,
  type ReminderKey,
  type ReminderRecipientKind,
} from "@/lib/arrival/reminderPlan";
import { sendEmail } from "@/lib/email/sendEmail";
import { createNotification } from "@/lib/notifications/createNotification";
import { resolveGuides } from "@/lib/guides/picks";

/**
 * Avisos automáticos de llegada (DR29, lote 2B). Cuelga del cron horario. Estudiante a 14/7/2/0 días de `start_date`;
 * familiar con vínculo ACTIVO solo a 7 y 2. Nunca antes de las 9:00 de Argentina. In-app siempre; email solo si
 * `EMAIL_DOMAIN_VERIFIED=true` (el remitente sandbox de Resend no entrega a destinatarios reales). Idempotente: la fila
 * de `arrival_reminder_sends` se inserta ANTES de enviar y el UNIQUE evita repetir. Si la tabla no existe (migración 0069
 * sin aplicar) no envía nada. Best-effort: nunca lanza.
 */
export async function notifyArrivalReminders(admin: SupabaseClient, now: Date = new Date()): Promise<{ sentCount: number }> {
  try {
    if (!isReminderHour(now)) return { sentCount: 0 };
    const today = todayIso(now);

    // Sonda de la tabla antes de cualquier trabajo.
    // Cualquier error de la sonda es degradación silenciosa (migración 0069 sin aplicar): sin log cada hora.
    const probe = await admin.from("arrival_reminder_sends").select("id").limit(1);
    if (probe.error) return { sentCount: 0 };

    // Ventana: hoy..hoy+14 (fechas date-only; el filtro fino por día exacto se hace en código).
    const limit = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const { data: rows, error } = await admin
      .from("reservations")
      .select("id, start_date, status, student_profile_id, residences(name), student_profiles!inner(user_id, first_name)")
      .in("status", [...REMINDER_RESERVATION_STATUSES])
      .gte("start_date", today)
      .lte("start_date", todayIso(limit));
    if (error) {
      console.error("[jobs] notifyArrivalReminders query falló:", error);
      return { sentCount: 0 };
    }

    const emailEnabled = process.env.EMAIL_DOMAIN_VERIFIED === "true";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || undefined;
    const guideSlug = resolveGuides(["02"])[0]?.slug ?? null;
    let sentCount = 0;

    for (const row of (rows ?? []) as unknown as {
      id: string;
      start_date: string;
      student_profile_id: string;
      residences: { name: string } | { name: string }[] | null;
      student_profiles: { user_id: string; first_name: string } | { user_id: string; first_name: string }[];
    }[]) {
      const key = reminderKeyForDays(daysUntil(row.start_date, today));
      if (!key) continue;
      const residence = Array.isArray(row.residences) ? row.residences[0] : row.residences;
      const profile = Array.isArray(row.student_profiles) ? row.student_profiles[0] : row.student_profiles;
      if (!profile) continue;

      const recipients: { userId: string; kind: ReminderRecipientKind }[] = [];
      if (recipientGetsReminder("student", key)) recipients.push({ userId: profile.user_id, kind: "student" });
      if (recipientGetsReminder("family", key)) {
        const { data: links, error: linkError } = await admin
          .from("family_links")
          .select("family_members!inner(user_id)")
          .eq("student_profile_id", row.student_profile_id)
          .eq("status", "active");
        if (linkError) console.error("[jobs] notifyArrivalReminders vínculos falló:", linkError);
        for (const l of (links ?? []) as unknown as { family_members: { user_id: string } | { user_id: string }[] }[]) {
          const fm = Array.isArray(l.family_members) ? l.family_members[0] : l.family_members;
          if (fm?.user_id) recipients.push({ userId: fm.user_id, kind: "family" });
        }
      }

      for (const r of recipients) {
        const { data: user, error: userError } = await admin.from("users").select("email, is_active, is_blocked").eq("id", r.userId).maybeSingle();
        if (userError) {
          console.error("[jobs] notifyArrivalReminders lectura de usuario falló:", userError);
          continue;
        }
        // Cuenta dada de baja o bloqueada: no se avisa (family_members no tiene estado propio; el vínculo debe estar 'active').
        if (!user || user.is_active === false || user.is_blocked === true) continue;
        const copy = buildReminderCopy({
          kind: r.kind,
          key,
          residenceName: residence?.name ?? "",
          studentFirstName: profile.first_name,
          guideSlug,
          baseUrl,
        });
        if (await claimSend(admin, row.id, r.userId, key, "in_app")) {
          await createNotification(admin, {
            category: "deadlines",
            userId: r.userId,
            title: copy.title,
            body: copy.body,
            relatedEntityType: "arrival_reminders",
            relatedEntityId: row.id,
          });
          sentCount += 1;
        }
        if (emailEnabled && (await claimSend(admin, row.id, r.userId, key, "email"))) {
          const ok = user.email ? await sendEmail({ to: user.email as string, subject: copy.emailSubject, html: copy.emailHtml }) : false;
          // Si el mail no salió, se libera el registro del canal email para reintentar en la próxima corrida.
          if (!ok) await releaseSend(admin, row.id, r.userId, key, "email");
        }
      }
    }
    return { sentCount };
  } catch (error) {
    console.error("[jobs] notifyArrivalReminders falló:", error);
    return { sentCount: 0 };
  }
}

/** Registra el envío; true si es nuevo (hay que enviar), false si ya existía o no se pudo registrar. */
async function claimSend(admin: SupabaseClient, reservationId: string, userId: string, key: ReminderKey, channel: "in_app" | "email"): Promise<boolean> {
  const { error } = await admin
    .from("arrival_reminder_sends")
    .insert({ reservation_id: reservationId, recipient_user_id: userId, reminder_key: key, channel });
  if (!error) return true;
  if (!isDuplicateSend(error) && !isMissingSendsTable(error)) console.error("[jobs] notifyArrivalReminders registro falló:", error);
  return false;
}

async function releaseSend(admin: SupabaseClient, reservationId: string, userId: string, key: ReminderKey, channel: "in_app" | "email"): Promise<void> {
  const { error } = await admin
    .from("arrival_reminder_sends")
    .delete()
    .eq("reservation_id", reservationId)
    .eq("recipient_user_id", userId)
    .eq("reminder_key", key)
    .eq("channel", channel);
  if (error) console.error("[jobs] notifyArrivalReminders no pudo liberar el registro:", error);
}
