/**
 * Seed aditivo (Ciclo 51, D32): una solicitud NUEVA a Residencia Norte demo de
 * un estudiante adulto que comparte todo su perfil (Mateo: presentación,
 * hábitos e intereses), para ver el bloque "Quién solicita" completo en el
 * inbox. Camila (no comparte hábitos/intereses) y Lucía ya cubren el caso
 * "eligió no compartir". El caso de un menor se cubre con tests unitarios
 * (`lib/applications/applicantProfile.test.ts`): Valentina queda sin familiar
 * vinculado a propósito (docs/17) y no puede tener solicitudes.
 *
 * Idempotente: no duplica si Mateo ya tiene una solicitud a esa residencia.
 * Uso: node --env-file=.env.local scripts/seed-demo-applicant-profile.mjs
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: residence } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").maybeSingle();
if (!residence) {
  console.error("No existe residencia-norte-demo. Correr antes scripts/seed-demo-data.mjs");
  process.exit(1);
}
const { data: mateo } = await admin
  .from("student_profiles")
  .select("id, user_id, academic_objective")
  .eq("first_name", "Mateo")
  .limit(1)
  .maybeSingle();
if (!mateo) {
  console.error("No existe el estudiante demo Mateo. Correr antes scripts/seed-residence-community.mjs");
  process.exit(1);
}
const { data: existing } = await admin
  .from("application_requests")
  .select("id")
  .eq("residence_id", residence.id)
  .eq("student_profile_id", mateo.id)
  .limit(1);
if (existing?.length) {
  console.log("· ya existe una solicitud de Mateo a Residencia Norte");
  process.exit(0);
}
const { data: roomType } = await admin
  .from("room_types")
  .select("id, monthly_price_usd")
  .eq("residence_id", residence.id)
  .eq("is_active", true)
  .order("monthly_price_usd", { ascending: true })
  .limit(1)
  .maybeSingle();
if (!roomType) {
  console.error("Residencia Norte demo no tiene tipos de habitación activos.");
  process.exit(1);
}

const RATE = 1520;
const months = 6;
const usd = Number(roomType.monthly_price_usd);
const feeBaseUsd = usd * months;
const { data: snap, error: snapError } = await admin
  .from("application_snapshots")
  .insert({
    snapshot_type: "original",
    residence_id: residence.id,
    room_type_id: roomType.id,
    monthly_price_usd: usd,
    monthly_price_ars: Math.round(usd * RATE),
    exchange_rate_ars_per_usd: RATE,
    exchange_rate_source: "monedapi.ar",
    exchange_rate_date: new Date().toISOString().slice(0, 10),
    initial_duration_months: months,
    deposit_excluded_from_fee: true,
    reservation_payment_amount_usd: usd,
    reservation_payment_amount_ars: Math.round(usd * RATE),
    adjustment_policy: "quarterly",
    fee_base_usd: feeBaseUsd,
    fee_base_ars: Math.round(feeBaseUsd * RATE),
    estimated_estured_fee_ars: Math.round((feeBaseUsd * RATE * 0.05) / 500) * 500,
  })
  .select("id")
  .single();
if (snapError) throw snapError;

const start = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
const { data: app, error } = await admin
  .from("application_requests")
  .insert({
    student_profile_id: mateo.id,
    initiated_by: "student",
    contact_target: "student",
    residence_id: residence.id,
    room_type_id: roomType.id,
    status: "submitted",
    desired_start_date: start,
    initial_duration_months: months,
    academic_objective: mateo.academic_objective ?? "Cursar la carrera de grado completa en Buenos Aires.",
    snapshot_original_id: snap.id,
    created_by_user_id: mateo.user_id,
    expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
  })
  .select("id")
  .single();
if (error) throw error;
await admin.from("application_snapshots").update({ application_request_id: app.id }).eq("id", snap.id);
await admin.from("application_status_events").insert({
  application_request_id: app.id,
  from_status: null,
  to_status: "submitted",
  changed_by_user_id: mateo.user_id,
  changed_by_role: "student",
});
console.log("✓ solicitud de Mateo a Residencia Norte demo:", app.id);
