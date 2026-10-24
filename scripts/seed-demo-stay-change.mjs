/**
 * Seed demo del flujo "Quiero cambiar" (Ciclo 59, DR3). ADITIVO e idempotente: no borra reservas, estadías ni
 * solicitudes; solo (re)crea los avisos demo de este script y la política de salida de las residencias demo.
 * Requiere la migración 0044 aplicada en estured-dev. Se niega a correr contra producción (_assert-dev-project).
 *
 * Deja:
 *  - Políticas de salida anticipada (públicas) en Río de la Plata y Norte.
 *  - Lucía (Río de la Plata): aviso ABIERTO, ya RESPONDIDO por la residencia (sin ver todavía). Martín (familiar vinculado)
 *    lo ve en solo lectura, sin su mensaje privado. Si Lucía tiene una solicitud/lista en otra residencia, se vincula al
 *    aviso (señal "en proceso de mudanza" + nota voluntaria).
 *  - Un residente de Norte (Tomás si existe) con aviso ABIERTO, respondido y VISTO.
 *  - Otro residente de Norte con aviso RESUELTO (reserva nueva: solo se ve la fecha de ingreso) para probar "Registrar salida".
 *  - No siembra un aviso `pending_guardian_confirmation` (menor): ninguna demo de menor tiene reserva ni estadía.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-stay-change.mjs
 * ⚠ Si se re-corre scripts/seed-demo-data.mjs (borra y recrea reservas con UUID nuevo) hay que re-correr este seed.
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

const probe = await admin.from("stay_change_intents").select("id").limit(1);
if (probe.error) {
  console.error("✗ La tabla stay_change_intents no existe: aplicá primero db/migrations/0044_stay_change_intents.sql en estured-dev.");
  process.exit(1);
}

const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

const residenceBySlug = async (slug) => (await admin.from("residences").select("id, name").eq("slug", slug).maybeSingle()).data;
const rio = await residenceBySlug("residencia-rio-de-la-plata-demo");
const norte = await residenceBySlug("residencia-norte-demo");
if (!rio || !norte) {
  console.error("✗ Faltan las residencias demo (correr scripts/seed-demo-data.mjs primero).");
  process.exit(1);
}
const userId = async (email) => (await admin.from("users").select("id").eq("email", email).maybeSingle()).data?.id;
const ricardo = await userId("owner.residencia.norte@example.com");

// 1. Política de salida anticipada (pública) de las residencias demo.
await admin
  .from("residences")
  .update({
    early_exit_deposit_clauses_text:
      "El depósito se devuelve dentro de los 30 días de la salida, una vez revisada la habitación. Se descuentan únicamente daños comprobados.",
    early_exit_costs_text: "Si te vas antes de cumplir la estadía mínima, el depósito no se devuelve.",
    early_exit_conditions_text: "Preaviso de 30 días con la fecha exacta de salida. Entrega de la habitación con administración.",
  })
  .in("id", [rio.id, norte.id]);
console.log("✓ Política de salida anticipada cargada en Río de la Plata y Norte");

async function currentStay(studentProfileId, residenceId) {
  const { data } = await admin
    .from("resident_stays")
    .select("id, reservation_id, start_date, expected_end_date")
    .eq("student_profile_id", studentProfileId)
    .eq("residence_id", residenceId)
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();
  return data;
}

async function seedIntent({ label, studentProfileId, residenceId, stay, patch }) {
  await admin.from("stay_change_intents").delete().eq("student_profile_id", studentProfileId);
  const noticeStart = patch.notice_started_at ?? daysAgo(5);
  const { data, error } = await admin
    .from("stay_change_intents")
    .insert({
      student_profile_id: studentProfileId,
      resident_stay_id: stay.id,
      reservation_id: stay.reservation_id,
      current_residence_id: residenceId,
      terms_accepted_at: noticeStart,
      notice_started_at: noticeStart,
      payment_unlocked_at: new Date(new Date(noticeStart).getTime() + 2 * DAY).toISOString(),
      expires_at: new Date(new Date(noticeStart).getTime() + 90 * DAY).toISOString(),
      created_by_user_id: patch.created_by_user_id,
      created_at: noticeStart,
      ...patch,
    })
    .select("id")
    .single();
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    return null;
  }
  console.log(`✓ ${label}: ${data.id}`);
  return data.id;
}

// 2. Lucía @ Río de la Plata: aviso abierto, respondido, sin ver. Martín lo ve en solo lectura.
const luciaUser = await userId("lucia.fernandez@example.com");
const { data: lucia } = await admin.from("student_profiles").select("id").eq("user_id", luciaUser).maybeSingle();
if (lucia) {
  const stay = await currentStay(lucia.id, rio.id);
  if (!stay) console.log("• Lucía no tiene estadía en Río de la Plata: se saltea (correr seed-demo-data.mjs)");
  else {
    const intentId = await seedIntent({
      label: "Lucía → aviso abierto con respuesta de Río de la Plata",
      studentProfileId: lucia.id,
      residenceId: rio.id,
      stay,
      patch: {
        created_by_user_id: luciaUser,
        status: "open",
        estimated_exit_date: daysAhead(55),
        student_message: "Me cambio de facultad y busco algo más cerca de Ciudad Universitaria.",
        residence_response_message: "Hola Lucía, gracias por avisarnos con tiempo. Te contamos cómo sería tu salida para que lo tengas en cuenta al decidir.",
        residence_exit_costs_text: "Si salís antes del fin de tu estadía mínima, el depósito no se devuelve.",
        residence_exit_costs_usd: 320,
        residence_exit_conditions_text: "Preaviso de 30 días con la fecha exacta de salida.",
        residence_exit_details_text: "Coordinamos la entrega de la habitación con administración.",
        residence_responded_at: daysAgo(2),
        residence_responded_by_user_id: ricardo,
      },
    });
    if (intentId) {
      // Vincula (si hay) una solicitud y una lista de espera de Lucía en OTRA residencia: señal "en proceso de mudanza".
      const { data: app } = await admin
        .from("application_requests")
        .select("id")
        .eq("student_profile_id", lucia.id)
        .neq("residence_id", rio.id)
        .in("status", ["submitted", "under_review", "contact_established", "queued_for_place"])
        .limit(1)
        .maybeSingle();
      if (app) {
        await admin
          .from("application_requests")
          .update({ stay_change_intent_id: intentId, move_context_note: "Me mudo desde otra residencia porque me cambié de facultad." })
          .eq("id", app.id);
        console.log("  · solicitud de Lucía vinculada al aviso:", app.id);
      }
      const { data: entry } = await admin
        .from("waitlist_entries")
        .select("id")
        .eq("student_profile_id", lucia.id)
        .neq("residence_id", rio.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (entry) {
        await admin.from("waitlist_entries").update({ stay_change_intent_id: intentId }).eq("id", entry.id);
        console.log("  · lista de espera de Lucía vinculada al aviso:", entry.id);
      }
    }
  }
}

// 3 y 4. Residentes de Norte con cuenta (comunidad demo): uno respondido y visto, otro resuelto.
const { data: norteStays } = await admin
  .from("resident_stays")
  .select("id, student_profile_id, reservation_id, student_profiles(first_name, user_id)")
  .eq("residence_id", norte.id)
  .eq("is_current", true)
  .eq("status", "active")
  .not("student_profile_id", "is", null);
const candidates = (norteStays ?? []).filter((s) => s.student_profiles?.user_id && s.student_profile_id !== lucia?.id);
const tomas = candidates.find((s) => s.student_profiles.first_name === "Tomás") ?? candidates[0];
const other = candidates.find((s) => s.id !== tomas?.id);

if (tomas) {
  await seedIntent({
    label: `${tomas.student_profiles.first_name} (Norte) → aviso abierto, respondido y visto`,
    studentProfileId: tomas.student_profile_id,
    residenceId: norte.id,
    stay: tomas,
    patch: {
      created_by_user_id: tomas.student_profiles.user_id,
      status: "open",
      estimated_exit_date: daysAhead(80),
      student_message: "Voy a hacer un intercambio y necesito una opción más corta.",
      residence_response_message: "Gracias por avisarnos con tiempo. Cuando tengas la fecha exacta, avisanos y coordinamos la entrega.",
      residence_exit_costs_text: "No hay costos de salida anticipada.",
      residence_exit_conditions_text: "Preaviso de 15 días.",
      residence_responded_at: daysAgo(3),
      residence_responded_by_user_id: ricardo,
      response_seen_by_student_at: daysAgo(2),
    },
  });
} else console.log("• No hay residentes con cuenta en Norte: se saltea el aviso respondido");

if (other) {
  await seedIntent({
    label: `${other.student_profiles.first_name} (Norte) → aviso RESUELTO (reserva nueva en otra residencia)`,
    studentProfileId: other.student_profile_id,
    residenceId: norte.id,
    stay: other,
    patch: {
      created_by_user_id: other.student_profiles.user_id,
      status: "resolved_new_reservation",
      estimated_exit_date: daysAhead(25),
      resolved_new_start_date: daysAhead(30),
      resolved_at: daysAgo(1),
      notice_started_at: daysAgo(20),
    },
  });
} else console.log("• No hay un segundo residente con cuenta en Norte: se saltea el aviso resuelto");

console.log("\nSeed de 'Quiero cambiar' listo. Login demo: Lucía (estudiante), Martín (familiar de Lucía), Ricardo (residencia).");
