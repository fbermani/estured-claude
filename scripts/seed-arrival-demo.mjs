/**
 * Seed ADITIVO (DR29, lote 2A/2B): deja un demo para ver la tarjeta «Tu llegada» (components/students/ArrivalCard.tsx)
 * y probar el aviso t7 de `notifyArrivalReminders`.
 *
 * Reutiliza a Lucía (estudiante demo) y su reserva `confirmed` de Residencia Norte, y le pone `start_date` = hoy (hora de
 * Argentina) + 7 días exactos. Asegura que Martín (familiar demo) tenga un family_link `active` a Lucía. Limpia las
 * marcas de avisos (`arrival_reminder_sends`) y las notificaciones `arrival_reminders` de esa reserva para poder
 * re-probar el job desde cero.
 *
 * Uso (DESPUÉS de seed-demo-users.mjs y seed-demo-data.mjs; migraciones 0068 y 0069 aplicadas):
 *   node --env-file=.env.local scripts/seed-arrival-demo.mjs [diasHastaIngreso=7]
 *
 * Idempotente: correrlo de nuevo solo vuelve a fijar la fecha relativa a hoy. No crea filas con UUID nuevo ni toca
 * otros datos. ⚠️ Cambia la `start_date` original de esa reserva (2026-07-20 en seed-demo-data.mjs); re-correr ese seed
 * la restaura. Guard de producción incluido.
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const DAYS = Number(process.argv[2] ?? 7);

// Hoy en Argentina (America/Argentina/Buenos_Aires) + DAYS, como YYYY-MM-DD.
const todayAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const d = new Date(`${todayAr}T00:00:00Z`);
d.setUTCDate(d.getUTCDate() + DAYS);
const startDate = d.toISOString().slice(0, 10);

const { data: lucia } = await admin.from("users").select("id").eq("email", "lucia.fernandez@example.com").single();
const { data: martin } = await admin.from("users").select("id").eq("email", "padre.lucia@example.com").single();
if (!lucia || !martin) {
  console.error("Faltan Lucía o Martín: correr antes seed-demo-users.mjs");
  process.exit(1);
}
const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", lucia.id).single();
const { data: fm } = await admin.from("family_members").select("id").eq("user_id", martin.id).single();

// 1. Reserva confirmed de Lucía (la de start_date más cercana a hoy si hay varias).
const { data: res } = await admin
  .from("reservations")
  .select("id, start_date, residences(name)")
  .eq("student_profile_id", profile.id)
  .eq("status", "confirmed")
  .order("start_date", { ascending: false })
  .limit(1);
if (!res?.length) {
  console.error("Lucía no tiene una reserva `confirmed`: correr antes seed-demo-data.mjs");
  process.exit(1);
}
const reservation = res[0];
const { error: upErr } = await admin.from("reservations").update({ start_date: startDate }).eq("id", reservation.id);
if (upErr) throw upErr;

// 2. Vínculo activo Martín ↔ Lucía.
const { data: link } = await admin
  .from("family_links")
  .select("id, status")
  .eq("student_profile_id", profile.id)
  .eq("family_member_id", fm.id)
  .maybeSingle();
if (!link) {
  const { error } = await admin.from("family_links").insert({
    student_profile_id: profile.id,
    family_member_id: fm.id,
    status: "active",
    requested_by_user_id: martin.id,
    approved_at: new Date().toISOString(),
  });
  if (error) throw error;
} else if (link.status !== "active") {
  const { error } = await admin.from("family_links").update({ status: "active", revoked_at: null }).eq("id", link.id);
  if (error) throw error;
}

// 3. Reset de avisos para poder re-probar el job.
const sends = await admin.from("arrival_reminder_sends").delete().eq("reservation_id", reservation.id);
if (sends.error) console.log("· arrival_reminder_sends no disponible (¿0069 sin aplicar?):", sends.error.message);
await admin.from("notifications").delete().eq("related_entity_type", "arrival_reminders").eq("related_entity_id", reservation.id);

console.log(`✓ Reserva ${reservation.id} (${reservation.residences?.name ?? "residencia"}) de Lucía: start_date ${reservation.start_date} → ${startDate} (hoy AR ${todayAr} + ${DAYS}).`);
console.log("✓ Vínculo Martín ↔ Lucía: active. Avisos previos de esa reserva limpiados.");
