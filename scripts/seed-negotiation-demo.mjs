/**
 * Seed demo (solo dev) para verificar las pantallas de negociación:
 *  (1) Camila @ Río de la Plata/Individual en offer_pending_student_acceptance + propuesta.
 *  (2) Lucía  @ Río de la Plata/Individual en contact_established (proposal_count 0).
 * Marca: academic_objective empieza con "[DEMO-NEG]". Idempotente (borra y recrea sus filas).
 * Uso: node --env-file=.env.local scripts/seed-negotiation-demo.mjs [--delete]
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const MARK = "[DEMO-NEG]";
const RATE = 1520;
const today = new Date().toISOString().slice(0, 10);

async function uid(email) {
  const { data } = await admin.from("users").select("id").eq("email", email).single();
  return data.id;
}
async function student(email) {
  const userId = await uid(email);
  const { data } = await admin.from("student_profiles").select("id").eq("user_id", userId).single();
  return { userId, profileId: data.id };
}

// Limpieza previa
const { data: old } = await admin.from("application_requests").select("id").like("academic_objective", `${MARK}%`);
const oldIds = (old ?? []).map((r) => r.id);
if (oldIds.length) {
  await admin.from("application_negotiation_proposals").delete().in("application_request_id", oldIds);
  await admin.from("application_status_events").delete().in("application_request_id", oldIds);
  await admin.from("application_requests").delete().in("id", oldIds);
  await admin.from("application_snapshots").delete().in("application_request_id", oldIds);
  console.log("Borradas", oldIds.length, "solicitudes demo-neg previas");
}
if (process.argv.includes("--delete")) process.exit(0);

const { data: res } = await admin.from("residences").select("id").eq("name", "Residencia Río de la Plata").single();
const { data: rt } = await admin.from("room_types").select("id").eq("residence_id", res.id).eq("name", "Individual").single();
const ricardoId = await uid("owner.residencia.norte@example.com");

async function make({ st, status, months, startDate }) {
  const usd = 350, enroll = 100, deposit = 350;
  const feeBaseUsd = usd * months + enroll;
  const { data: snap, error: e1 } = await admin.from("application_snapshots").insert({
    snapshot_type: "original", residence_id: res.id, room_type_id: rt.id,
    monthly_price_usd: usd, monthly_price_ars: usd * RATE, exchange_rate_ars_per_usd: RATE,
    exchange_rate_source: "monedapi.ar", exchange_rate_date: today, initial_duration_months: months,
    enrollment_fee_usd: enroll, enrollment_fee_ars: enroll * RATE, deposit_usd: deposit, deposit_ars: deposit * RATE,
    deposit_excluded_from_fee: true, reservation_payment_amount_usd: usd, reservation_payment_amount_ars: usd * RATE,
    adjustment_policy: "quarterly", fee_base_usd: feeBaseUsd, fee_base_ars: feeBaseUsd * RATE,
    estimated_estured_fee_ars: Math.round((feeBaseUsd * RATE * 0.05) / 500) * 500,
  }).select("id").single();
  if (e1) throw e1;
  const { data: app, error: e2 } = await admin.from("application_requests").insert({
    student_profile_id: st.profileId, initiated_by: "student", contact_target: "student",
    residence_id: res.id, room_type_id: rt.id, status, desired_start_date: startDate,
    initial_duration_months: months, academic_objective: `${MARK} Demo negociación`,
    snapshot_original_id: snap.id, created_by_user_id: st.userId,
    contact_established_at: new Date().toISOString(),
    payment_deadline_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  }).select("id").single();
  if (e2) throw e2;
  await admin.from("application_snapshots").update({ application_request_id: app.id }).eq("id", snap.id);
  const chain = ["submitted", "under_review", "contact_established", ...(status === "offer_pending_student_acceptance" ? [status] : [])];
  await admin.from("application_status_events").insert(chain.map((to, i) => ({
    application_request_id: app.id, from_status: i ? chain[i - 1] : null, to_status: to,
    changed_by_user_id: i ? null : st.userId, changed_by_role: i ? "residence_owner" : "student",
  })));
  return app.id;
}

const camila = await student("camila.rojas@example.com");
const lucia = await student("lucia.fernandez@example.com");
const appOffer = await make({ st: camila, status: "offer_pending_student_acceptance", months: 4, startDate: "2027-03-01" });
const { error: ep } = await admin.from("application_negotiation_proposals").insert({
  application_request_id: appOffer, sent_by_user_id: ricardoId, residence_id: res.id,
  proposed_monthly_price_usd: 320, proposed_monthly_price_ars: 320 * RATE, proposed_enrollment_fee_usd: 80,
  proposed_enrollment_fee_ars: 80 * RATE, proposed_deposit_usd: 300, proposed_deposit_ars: 300 * RATE,
  proposed_duration_months: 6, proposed_start_date: "2027-03-15",
  special_conditions: "Descuento mensual a cambio de extender la estadía a 6 meses.",
});
if (ep) throw ep;
const appContact = await make({ st: lucia, status: "contact_established", months: 6, startDate: "2027-03-01" });
console.log("Oferta (Camila):", appOffer, "\nContacto (Lucía, Ricardo):", appContact, "\nResidencia:", res.id);
