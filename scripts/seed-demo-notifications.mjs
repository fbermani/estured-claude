/**
 * Seed de notificaciones demo (Ciclo 47, H20): deja notificaciones con
 * entidad relacionada real para Camila (estudiante), Ricardo (owner) y el
 * admin, así las pantallas con enlace y estado "leída" se pueden ver con los
 * usuarios demo. Lucía ya tiene las suyas (renovaciones) del seed principal.
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-demo-notifications.mjs
 *
 * Idempotente: borra las notificaciones demo de este script (por título) y las
 * vuelve a crear con entidades que existen en la base. No toca otras filas.
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const userId = async (email) => (await admin.from("users").select("id").eq("email", email).single()).data?.id;
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

const camila = await userId("camila.rojas@example.com");
const ricardo = await userId("owner.residencia.norte@example.com");
const adminUser = await userId("admin.operaciones@estured.test");

const { data: camilaProfile } = await admin.from("student_profiles").select("id").eq("user_id", camila).single();
const { data: camilaApps } = await admin
  .from("application_requests")
  .select("id, status")
  .eq("student_profile_id", camilaProfile.id)
  .order("created_at", { ascending: false });
const { data: camilaReservations } = await admin
  .from("reservations")
  .select("id")
  .eq("student_profile_id", camilaProfile.id)
  .limit(1);
const { data: residence } = await admin
  .from("residence_users")
  .select("residence_id")
  .eq("user_id", ricardo)
  .eq("role", "owner")
  .limit(1)
  .single();
const { data: supportCase } = await admin
  .from("support_cases")
  .select("id")
  .eq("residence_id", residence.residence_id)
  .limit(1)
  .maybeSingle();
const { data: anyReservation } = await admin.from("reservations").select("id").limit(1).single();

const lucia = await userId("lucia.fernandez@example.com");
const { data: luciaProfile } = await admin.from("student_profiles").select("id").eq("user_id", lucia).single();
const { data: luciaReservation } = await admin
  .from("reservations")
  .select("id")
  .eq("student_profile_id", luciaProfile.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const rows = [];
if (luciaReservation)
  rows.push({
    user_id: lucia,
    title: "Te dieron otra chance para pagar el fee EstuRed",
    body: "Se reabrió el plazo para pagar el fee de tu reserva.",
    related_entity_type: "reservations",
    related_entity_id: luciaReservation.id,
    created_at: hoursAgo(1),
  });
if (camilaApps?.[0])
  rows.push({
    user_id: camila,
    title: "Tu solicitud fue reabierta",
    body: "EstuRed reabrió tu solicitud. Entrá al detalle para ver cómo sigue.",
    related_entity_type: "application_requests",
    related_entity_id: camilaApps[0].id,
    created_at: hoursAgo(2),
  });
if (camilaReservations?.[0])
  rows.push({
    user_id: camila,
    title: "Te dieron otra chance para pagar el fee EstuRed",
    body: "Se reabrió el plazo para pagar el fee de tu reserva.",
    related_entity_type: "reservations",
    related_entity_id: camilaReservations[0].id,
    created_at: hoursAgo(30),
  });
rows.push({
  user_id: camila,
  title: "Bienvenida a EstuRed",
  body: "Ya podés explorar residencias y enviar solicitudes.",
  read_at: hoursAgo(70),
  created_at: hoursAgo(72),
});
rows.push({
  user_id: ricardo,
  title: "EstuRed reactivó tu residencia",
  body: "Tu residencia volvió a estar publicada.",
  related_entity_type: "residences",
  related_entity_id: residence.residence_id,
  created_at: hoursAgo(5),
});
if (supportCase)
  rows.push({
    user_id: ricardo,
    title: "Tu caso de soporte se resolvió",
    body: "Revisá la resolución en la sección de Soporte.",
    related_entity_type: "support_cases",
    related_entity_id: supportCase.id,
    read_at: hoursAgo(20),
    created_at: hoursAgo(48),
  });
if (anyReservation)
  rows.push({
    user_id: adminUser,
    title: "Falló un registro de auditoría de dinero",
    body: "Una acción se completó, pero no se pudo auditar. Revisar manualmente.",
    related_entity_type: "reservations",
    related_entity_id: anyReservation.id,
    created_at: hoursAgo(3),
  });

const titles = [...new Set(rows.map((r) => r.title))];
const owners = [...new Set(rows.map((r) => r.user_id))];
const { error: delError } = await admin.from("notifications").delete().in("user_id", owners).in("title", titles);
if (delError) throw delError;
const { error } = await admin.from("notifications").insert(rows);
if (error) throw error;
console.log(`Notificaciones demo: ${rows.length} creadas.`);
