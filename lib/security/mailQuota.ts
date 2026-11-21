import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeRateLimit } from "@/lib/security/rateLimit";

/**
 * Cuota diaria de mails por residencia (auditoría de costos 2026-11-21, C5). Protege la cuota de Resend y los buzones del equipo si
 * alguien dispara avisos o invitaciones en bucle. Persistente en Postgres (`consumeRateLimit`, migración 0083). Solo corta el MAIL:
 * la notificación dentro de la app se crea igual. Con la cuota agotada devuelve `false` y la persona ve «enlace listo para copiar» o
 * el aviso dentro de la app.
 */
const DAY_SECONDS = 86_400;

/** Avisos del equipo (solicitudes, lista de espera, renovaciones…) por residencia y día. */
export const TEAM_EVENT_MAILS_PER_DAY = 100;
/** Invitaciones a residentes por mail, por residencia y día. */
export const RESIDENT_INVITE_MAILS_PER_DAY = 200;

export async function teamEventMailAllowed(admin: SupabaseClient, residenceId: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "mail_team_event_residence", key: residenceId, windowSeconds: DAY_SECONDS, max: TEAM_EVENT_MAILS_PER_DAY }, admin)).ok;
}

export async function residentInviteMailAllowed(admin: SupabaseClient, residenceId: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "mail_resident_invite_residence", key: residenceId, windowSeconds: DAY_SECONDS, max: RESIDENT_INVITE_MAILS_PER_DAY }, admin)).ok;
}
