/**
 * Limpia el residuo de los tests de integración en la base de DESARROLLO:
 * residencias cuyo slug empieza con `residencia-test-` (las crean los tests,
 * p. ej. reissueBookingReceipt.test.ts) y todo lo que cuelga de ellas.
 *
 * Uso:
 *   node --env-file=.env.local scripts/cleanup-test-residences.mjs           # simulación (no borra nada)
 *   node --env-file=.env.local scripts/cleanup-test-residences.mjs --apply   # borra
 *
 * Seguro por diseño: guard anti-producción, filtra SOLO por slug de test, y
 * respeta el orden de borrado por FK circulares de seed-demo-data.mjs
 * (reservations ↔ estured_fee_payments/booking_receipts, renovaciones, etc.).
 * Se detiene ante el primer error.
 *
 * MANTENER SINCRONIZADO con lib/testing/deleteResidenceCascade.ts (mismo orden
 * de borrado; es el helper que usan los afterAll de los tests de integración).
 * Si se agrega una tabla con FK a residence_id sin cascade, tocar ambos.
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

async function run(label, query) {
  const { error, count } = await query;
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${apply ? "✓" : "·"} ${label}${typeof count === "number" ? ` (${count})` : ""}`);
}

// Tablas de la migración 0044 (Ciclo 59): si todavía no está aplicada en esta base, se omiten.
async function runIfTableExists(label, query) {
  const { error } = await query;
  if (error && /could not find the table|does not exist/i.test(error.message)) {
    console.log(`  - ${label}: tabla inexistente (migración 0044 sin aplicar), se omite`);
    return;
  }
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${apply ? "✓" : "·"} ${label}`);
}

const { data: residences, error: resError } = await admin
  .from("residences")
  .select("id, name, slug")
  .like("slug", "residencia-test-%");
if (resError) {
  console.error(resError.message);
  process.exit(1);
}
if (!residences?.length) {
  console.log("No hay residencias de test para limpiar.");
  process.exit(0);
}
console.log(`${apply ? "BORRANDO" : "SIMULACIÓN —"} ${residences.length} residencia(s) de test:`);
for (const r of residences) console.log(`- ${r.name} [${r.slug}] ${r.id}`);

// En simulación solo se cuentan filas; con --apply se ejecuta el borrado.
const del = (table, build) => (apply ? build(admin.from(table).delete({ count: "exact" })) : build(admin.from(table).select("*", { count: "exact", head: true })));
const upd = (table, values, build) => (apply ? build(admin.from(table).update(values, { count: "exact" })) : build(admin.from(table).select("*", { count: "exact", head: true })));

for (const residence of residences) {
  const id = residence.id;
  console.log(`\n# ${residence.slug}`);

  // DR3 (Ciclo 59): salidas anticipadas y avisos "Quiero cambiar" antes de estadías y reservas.
  await runIfTableExists("stay_early_exits", del("stay_early_exits", (q) => q.eq("residence_id", id)));
  await runIfTableExists("stay_change_intents", del("stay_change_intents", (q) => q.eq("current_residence_id", id)));
  await run("resident_stays", del("resident_stays", (q) => q.eq("residence_id", id)));
  await run("support_cases", del("support_cases", (q) => q.eq("residence_id", id)));

  const { data: apps } = await admin.from("application_requests").select("id").eq("residence_id", id);
  const appIds = (apps ?? []).map((a) => a.id);
  if (appIds.length) {
    const { data: reservations } = await admin.from("reservations").select("id").in("application_request_id", appIds);
    const reservationIds = (reservations ?? []).map((r) => r.id);
    if (reservationIds.length) {
      const { data: offers } = await admin.from("renewal_offers").select("id").in("reservation_id", reservationIds);
      const offerIds = (offers ?? []).map((o) => o.id);
      if (offerIds.length) {
        await run("renewal_offers: anular refs", upd("renewal_offers", { estured_fee_payment_id: null, renewal_receipt_id: null, external_residence_payment_id: null }, (q) => q.in("id", offerIds)));
        await run("renewal_receipts", del("renewal_receipts", (q) => q.in("renewal_offer_id", offerIds)));
        await run("estured_fee_payments (renovación)", del("estured_fee_payments", (q) => q.in("renewal_offer_id", offerIds)));
        await run("external_residence_payments (renovación)", del("external_residence_payments", (q) => q.in("renewal_offer_id", offerIds)));
        await run("renewal_offers", del("renewal_offers", (q) => q.in("id", offerIds)));
      }
      await run("renewal_requests", del("renewal_requests", (q) => q.in("reservation_id", reservationIds)));

      const { data: receipts } = await admin.from("booking_receipts").select("id").in("reservation_id", reservationIds);
      const receiptIds = (receipts ?? []).map((r) => r.id);
      if (receiptIds.length) {
        await run("audit_logs (booking_receipts)", del("audit_logs", (q) => q.eq("entity_type", "booking_receipts").in("entity_id", receiptIds)));
      }
      await run("audit_logs (reservations)", del("audit_logs", (q) => q.eq("entity_type", "reservations").in("entity_id", reservationIds)));
      await run("reservations: anular ciclo FK", upd("reservations", { estured_fee_payment_id: null, booking_receipt_id: null }, (q) => q.in("id", reservationIds)));
      await run("booking_receipts", del("booking_receipts", (q) => q.in("reservation_id", reservationIds)));
      await run("estured_fee_payments", del("estured_fee_payments", (q) => q.in("reservation_id", reservationIds)));
      const { data: payments } = await admin.from("external_residence_payments").select("id").in("application_request_id", appIds);
      const paymentIds = (payments ?? []).map((p) => p.id);
      if (paymentIds.length) {
        await run("external_residence_payments: soltar reserva", upd("external_residence_payments", { reservation_id: null }, (q) => q.in("id", paymentIds)));
      }
      await run("reservations", del("reservations", (q) => q.in("id", reservationIds)));
    }
    await run("external_residence_payments", del("external_residence_payments", (q) => q.in("application_request_id", appIds)));
    await run("application_requests: soltar propuesta familiar", upd("application_requests", { family_proposal_id: null }, (q) => q.in("id", appIds)));
  }
  await run("family_application_proposals", del("family_application_proposals", (q) => q.eq("residence_id", id)));
  await run("waitlist_entries", del("waitlist_entries", (q) => q.eq("residence_id", id)));
  await run("application_requests", del("application_requests", (q) => q.eq("residence_id", id)));
  // Después de las solicitudes: application_requests.snapshot_original_id referencia al snapshot.
  await run("application_snapshots (restantes)", del("application_snapshots", (q) => q.eq("residence_id", id)));

  if (apply) {
    const { error } = await admin.from("residences").delete().eq("id", id);
    if (error) {
      console.error(`✗ residences: ${error.message}\n  Falta cubrir una tabla con FK directa a residence_id sin cascade.`);
      process.exit(1);
    }
    console.log("  ✓ residences");
  } else {
    console.log("  · residences (se borraría)");
  }
}
console.log(apply ? "\nListo." : "\nSimulación terminada. Re-correr con --apply para borrar.");
