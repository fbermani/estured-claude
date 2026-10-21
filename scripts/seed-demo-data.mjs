/**
 * Seed de datos demo PERSISTENTES para explorar la app real con los
 * usuarios demo (docs/17). A diferencia de los scripts de setup e2e
 * usados durante el desarrollo (que se crean y se borran en la misma
 * sesión), estos datos están pensados para quedarse: residencias
 * verificadas + solicitudes/reservas/comprobantes en distintos estados
 * reales, así cada usuario demo tiene algo significativo para ver al
 * loguearse (widget "Simular sesión", DEMO_LOGIN_ENABLED=true local).
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-demo-users.mjs   (primero, si no corrió)
 *   node --env-file=.env.local scripts/seed-demo-data.mjs
 *
 * Idempotente por nombre/slug: si ya corrió, borra las residencias
 * demo anteriores (cascada limpia el resto) y las vuelve a crear —
 * más simple que reconciliar campo por campo.
 *
 * Simplificaciones deliberadas (no son bugs): sin fotos reales
 * (bucket public-residence-media vacío — la ficha funciona igual, solo
 * sin imagen destacada), tipo de cambio fijo 1520 ARS/USD (no se llama
 * a monedapi.ar desde el script), Valentina (menor) queda sin familiar
 * vinculado y sin solicitudes a propósito — es el escenario documentado
 * de "necesita vincular familiar antes de poder solicitar".
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

// Mismo formato que lib/receipts/receiptNumber.ts: ER-AAAA-XXXXX-XXXXX, 10 caracteres Crockford base32.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function receiptNumber(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const body = Array.from(bytes, (b) => CROCKFORD[b % 32]).join("");
  return `${prefix}-${new Date().getFullYear()}-${body.slice(0, 5)}-${body.slice(5)}`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const ARS_PER_USD = 1520;
const RATE_DATE = new Date().toISOString().slice(0, 10);
const usdToArs = (usd) => Math.round(usd * ARS_PER_USD);
const roundArs = (v) => Math.round(v / 500) * 500;
const feeEstimate = (monthlyUsd, months, enrollmentUsd = 0) => {
  const feeBaseUsd = monthlyUsd * months + enrollmentUsd;
  const feeBaseArs = usdToArs(feeBaseUsd);
  return { feeBaseUsd, feeBaseArs, estimatedFeeArs: roundArs(feeBaseArs * 0.05) };
};

async function userIdByEmail(email) {
  const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
  if (!data) throw new Error(`Falta el usuario demo ${email} — correr seed-demo-users.mjs primero`);
  return data.id;
}
async function studentProfileByEmail(email) {
  const uid = await userIdByEmail(email);
  const { data } = await admin.from("student_profiles").select("id, academic_objective").eq("user_id", uid).single();
  return { userId: uid, profileId: data.id, academicObjective: data.academic_objective };
}

const lucia = await studentProfileByEmail("lucia.fernandez@example.com");
const camila = await studentProfileByEmail("camila.rojas@example.com");
const martinUserId = await userIdByEmail("padre.lucia@example.com");
const { data: martinFamilyMember } = await admin
  .from("family_members")
  .select("id")
  .eq("user_id", martinUserId)
  .single();
const { data: luciaLink } = await admin
  .from("family_links")
  .select("id")
  .eq("family_member_id", martinFamilyMember.id)
  .eq("student_profile_id", lucia.profileId)
  .single();
const ricardoId = await userIdByEmail("owner.residencia.norte@example.com");
const sofiaId = await userIdByEmail("staff.norte@estured.test");

// ==== Limpieza de una corrida anterior (idempotencia por slug) ====
const DEMO_SLUGS = ["residencia-norte-demo", "residencia-rio-de-la-plata-demo", "casa-almagro-demo"];
for (const slug of DEMO_SLUGS) {
  const { data: existing } = await admin.from("residences").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    // resident_stays.reservation_id referencia reservations sin cascade
    // (migración 0019, Ciclo 33bis) — hay que borrarla antes de tocar
    // reservations más abajo, igual motivo que renewal_offers/requests.
    await admin.from("resident_stays").delete().eq("residence_id", existing.id);

    // support_cases.residence_id NO tiene cascade (migración 0023) — nunca
    // se limpiaba, encontrado en Ciclo 34unodevicies-quinquies porque
    // bloqueaba en silencio el DELETE de residences (sin chequeo de error
    // más abajo, el script seguía como si hubiera borrado). Mismo patrón
    // del gotcha #37 (application_snapshots huérfanas) — cualquier tabla
    // con FK directa a residence_id sin cascade necesita su propia línea acá.
    await admin.from("support_cases").delete().eq("residence_id", existing.id);
    // application_snapshots.residence_id tampoco tiene cascade — la vía
    // normal (application_request_id, con cascade) limpia la mayoría, pero
    // una snapshot que quedó con application_request_id null (gotcha #37)
    // sobrevive a la limpieza de application_requests de abajo y bloquea
    // el DELETE final de residences. Red de seguridad explícita.
    await admin.from("application_snapshots").delete().eq("residence_id", existing.id);

    // FK circular reservations<->estured_fee_payments/booking_receipts (MEMORY.md §15.10/13/15):
    // anular ambos lados antes de cualquier delete.
    const { data: apps } = await admin.from("application_requests").select("id").eq("residence_id", existing.id);
    const appIds = (apps ?? []).map((a) => a.id);
    if (appIds.length) {
      const { data: reservations } = await admin.from("reservations").select("id").in("application_request_id", appIds);
      const reservationIds = (reservations ?? []).map((r) => r.id);
      if (reservationIds.length) {
        // renewal_offers/renewal_requests (migración 0016, Ciclo 30) también
        // referencian reservation_id sin cascade — hay que limpiarlos antes
        // de borrar la reserva, mismo motivo que booking_receipts/fee_payments.
        const { data: offers } = await admin.from("renewal_offers").select("id").in("reservation_id", reservationIds);
        const offerIds = (offers ?? []).map((o) => o.id);
        if (offerIds.length) {
          // Bug real encontrado en Ciclo 31: faltaba anular external_residence_payment_id
          // y borrar la external_residence_payments de renovación antes del delete de
          // renewal_offers — no se manifestaba porque ninguna renovación demo llegaba
          // a pago confirmado hasta ahora (23503 en el próximo re-seed si no se corrige).
          await admin.from("renewal_offers").update({ estured_fee_payment_id: null, renewal_receipt_id: null, external_residence_payment_id: null }).in("id", offerIds);
          await admin.from("renewal_receipts").delete().in("renewal_offer_id", offerIds);
          await admin.from("estured_fee_payments").delete().in("renewal_offer_id", offerIds);
          await admin.from("external_residence_payments").delete().in("renewal_offer_id", offerIds);
          await admin.from("renewal_offers").delete().in("id", offerIds);
        }
        await admin.from("renewal_requests").delete().in("reservation_id", reservationIds);

        const { data: receipts } = await admin.from("booking_receipts").select("id").in("reservation_id", reservationIds);
        const receiptIds = (receipts ?? []).map((r) => r.id);
        if (receiptIds.length) {
          await admin.from("audit_logs").delete().eq("entity_type", "booking_receipts").in("entity_id", receiptIds);
        }
        await admin.from("audit_logs").delete().eq("entity_type", "reservations").eq("action", "estured_fee_revoked").in("entity_id", reservationIds);

        await admin.from("reservations").update({ estured_fee_payment_id: null, booking_receipt_id: null }).in("id", reservationIds);
        await admin.from("booking_receipts").delete().in("reservation_id", reservationIds);
        await admin.from("estured_fee_payments").delete().in("reservation_id", reservationIds);
        await admin.from("external_residence_payments").update({ reservation_id: null }).in("id",
          (await admin.from("external_residence_payments").select("id").in("application_request_id", appIds)).data?.map((p) => p.id) ?? []);
        await admin.from("reservations").delete().in("id", reservationIds);
      }
      await admin.from("external_residence_payments").delete().in("application_request_id", appIds);
      await admin.from("application_requests").update({ family_proposal_id: null }).in("id", appIds);
    }
    await admin.from("family_application_proposals").delete().eq("residence_id", existing.id);
    await admin.from("waitlist_entries").delete().eq("residence_id", existing.id);
    await admin.from("application_requests").delete().eq("residence_id", existing.id);
    const { error: deleteError } = await admin.from("residences").delete().eq("id", existing.id);
    if (deleteError) {
      throw new Error(
        `No se pudo borrar la residencia previa "${slug}" (${existing.id}): ${deleteError.message}. ` +
          `Probablemente falta cubrir una tabla con FK directa a residence_id sin cascade — revisar con la` +
          ` query de information_schema documentada en MEMORY.md antes de re-correr.`,
      );
    }
    console.log(`(limpieza) residencia previa "${slug}" borrada`);
  }
}

// ==== Residencias ====
async function createResidence({ name, slug, publicArea, status, description, tagline }) {
  const { data, error } = await admin
    .from("residences")
    .insert({
      name,
      slug,
      tagline,
      property_type: "residencia_estudiantil",
      description,
      status,
      operating_mode: "verified_profile",
      public_area: publicArea,
      responsible_name: "Ricardo Owner",
      responsible_contact: "+54 9 11 5555-0105",
      total_capacity: 10,
      created_by: ricardoId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
async function addOwner(residenceId, userId, role) {
  await admin.from("residence_users").insert({ residence_id: residenceId, user_id: userId, role, invitation_status: "accepted" });
}
// name -> personas por habitación. Sin esto, `capacity_per_room` cae al
// default de la columna (1) para TODOS los tipos — encontrado en Ciclo
// 35septendecies: Doble/Triple/Cuádruple quedaban con capacidad 1,
// inflando la cantidad de habitaciones que seed-rooms-and-content.mjs
// creaba para alojar a los residentes demo (ej. 10 habitaciones "Doble"
// en vez de las 4 reales que hacen falta para 8 personas).
const CAPACITY_BY_ROOM_NAME = { Individual: 1, Doble: 2, Triple: 3, Cuádruple: 4, Compartida: 4 };

async function addRoomType(residenceId, { name, usd, ars, count }) {
  // `adjustment_policy` vivía en `room_types` hasta la migración 0025
  // (Ciclo 22, "Condiciones de Reserva a nivel residencia") — se movió a
  // `residences.adjustment_policy` (default 'quarterly', ya cubre el caso
  // demo) y la columna se DROPeó de `room_types`. Este insert quedó
  // desactualizado desde entonces sin que ningún re-seed completo lo
  // ejercitara (encontrado en Ciclo 34unodevicies-quinquies).
  const { data, error } = await admin
    .from("room_types")
    .insert({
      residence_id: residenceId,
      name,
      monthly_price_usd: usd,
      monthly_price_ars: ars,
      capacity_per_room: CAPACITY_BY_ROOM_NAME[name] ?? 1,
    })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("profile_availability").insert({
    residence_id: residenceId,
    room_type_id: data.id,
    status: "available_to_confirm",
    available_count: count,
    last_confirmed_by: ricardoId,
  });
  return data.id;
}
async function addSections(residenceId, { services, universities, rules }) {
  await admin.from("residence_profile_sections").insert([
    { residence_id: residenceId, section_type: "services", content: { items: services } },
    { residence_id: residenceId, section_type: "near_universities", content: { items: universities } },
    { residence_id: residenceId, section_type: "rules", content: { summary: rules } },
  ]);
}

const norteId = await createResidence({
  name: "Residencia Norte",
  slug: "residencia-norte-demo",
  publicArea: "Palermo",
  status: "verified_active",
  tagline: "Cerca de todo, con onda",
  description: "Residencia verificada en Palermo, a metros de Plaza Italia. Ambientes luminosos y espacios comunes renovados.",
});
await addOwner(norteId, ricardoId, "owner");
await addOwner(norteId, sofiaId, "staff");
const norteApprovedAt = new Date();
await admin.from("residence_verifications").insert({
  residence_id: norteId,
  status: "approved",
  responsible_identity_checked: true,
  coordinator_identity_checked: true,
  address_checked: true,
  photos_match_reality: true,
  approved_at: norteApprovedAt.toISOString(),
  expires_at: new Date(norteApprovedAt.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
});
const norteIndividualId = await addRoomType(norteId, { name: "Individual", usd: 300, ars: 456000, count: 3 });
const norteDobleId = await addRoomType(norteId, { name: "Doble", usd: 220, ars: 334500, count: 2 });
await addRoomType(norteId, { name: "Triple", usd: 190, ars: 288800, count: 2 });
await addSections(norteId, {
  services: ["WiFi de alta velocidad", "Limpieza semanal de áreas comunes", "Lavadero", "Cocina equipada"],
  universities: ["Universidad de Palermo (UP)", "UBA - Facultad de Derecho"],
  rules: "Convivencia respetuosa, silencio después de las 23hs, visitas coordinadas con anticipación.",
});
console.log("✓ Residencia Norte:", norteId);

const rioplataId = await createResidence({
  name: "Residencia Río de la Plata",
  slug: "residencia-rio-de-la-plata-demo",
  publicArea: "Recoleta",
  status: "verified_active",
  tagline: "Habitaciones individuales",
  description: "Habitaciones individuales a pasos del Botánico, ideal para quienes buscan más independencia.",
});
await addOwner(rioplataId, ricardoId, "owner");
const rioplataEstudioId = await addRoomType(rioplataId, { name: "Individual", usd: 350, ars: 532000, count: 2 });
await addRoomType(rioplataId, { name: "Cuádruple", usd: 170, ars: 258400, count: 2 });
await addSections(rioplataId, {
  services: ["WiFi", "Aire acondicionado", "Seguridad 24hs"],
  universities: ["UBA - Facultad de Medicina", "Universidad Católica Argentina (UCA)"],
  rules: "Sin mascotas. Horario de portería 7-23hs, timbre coordinado fuera de ese rango.",
});
console.log("✓ Residencia Río de la Plata:", rioplataId);

const almagroId = await createResidence({
  name: "Casa Compartida Almagro",
  slug: "casa-almagro-demo",
  publicArea: "Almagro",
  status: "pending_verification",
  tagline: "Ambiente familiar",
  description: "Casa compartida de perfil familiar, habitaciones compartidas de hasta 3 estudiantes.",
});
await addOwner(almagroId, ricardoId, "owner");
await addRoomType(almagroId, { name: "Triple", usd: 180, ars: 273500, count: 4 });
await addRoomType(almagroId, { name: "Doble", usd: 210, ars: 319200, count: 2 });
await addSections(almagroId, {
  services: ["WiFi", "Desayuno incluido"],
  universities: ["UBA - Facultad de Ciencias Sociales"],
  rules: "Tareas domésticas rotativas entre residentes.",
});
await admin.from("residence_verifications").insert({
  residence_id: almagroId,
  status: "documents_pending",
  responsible_identity_checked: true,
  coordinator_identity_checked: false,
  address_checked: true,
  photos_match_reality: false,
});
console.log("✓ Casa Compartida Almagro (pendiente de verificación):", almagroId);

// ==== Helper: snapshot + application_requests ====
async function createSnapshot({ residenceId, roomTypeId, usd, ars, months, enrollmentUsd = null }) {
  const fee = feeEstimate(usd, months, enrollmentUsd ?? 0);
  const { data, error } = await admin
    .from("application_snapshots")
    .insert({
      snapshot_type: "original",
      residence_id: residenceId,
      room_type_id: roomTypeId,
      monthly_price_usd: usd,
      monthly_price_ars: ars,
      exchange_rate_ars_per_usd: ARS_PER_USD,
      exchange_rate_source: "monedapi.ar",
      exchange_rate_date: RATE_DATE,
      initial_duration_months: months,
      enrollment_fee_usd: enrollmentUsd,
      enrollment_fee_ars: enrollmentUsd ? usdToArs(enrollmentUsd) : null,
      deposit_excluded_from_fee: true,
      reservation_payment_amount_usd: enrollmentUsd ?? usd,
      reservation_payment_amount_ars: usdToArs(enrollmentUsd ?? usd),
      adjustment_policy: "quarterly",
      fee_base_usd: fee.feeBaseUsd,
      fee_base_ars: fee.feeBaseArs,
      estimated_estured_fee_ars: fee.estimatedFeeArs,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { snapshotId: data.id, fee };
}
async function createApplication({
  student,
  residenceId,
  roomTypeId,
  usd,
  ars,
  months,
  status,
  contactTarget = "student",
  familyLinkId = null,
  familyProposalId = null,
  initiatedBy = "student",
  startDate,
  contactEstablished = false,
}) {
  const { snapshotId, fee } = await createSnapshot({ residenceId, roomTypeId, usd, ars, months });
  const { data: app, error } = await admin
    .from("application_requests")
    .insert({
      student_profile_id: student.profileId,
      family_link_id: familyLinkId,
      family_proposal_id: familyProposalId,
      initiated_by: initiatedBy,
      contact_target: contactTarget,
      residence_id: residenceId,
      room_type_id: roomTypeId,
      status,
      desired_start_date: startDate,
      initial_duration_months: months,
      academic_objective: student.academicObjective,
      snapshot_original_id: snapshotId,
      created_by_user_id: student.userId,
      contact_established_at: contactEstablished ? new Date().toISOString() : null,
      // Igual que `establishContact`: plazo de 48h (H06; sin esto el job de vencimiento no la ve).
      payment_deadline_at: contactEstablished ? new Date(Date.now() + 48 * 3_600_000).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("application_snapshots").update({ application_request_id: app.id }).eq("id", snapshotId);
  await admin.from("application_status_events").insert({
    application_request_id: app.id,
    from_status: null,
    to_status: "submitted",
    changed_by_user_id: student.userId,
    changed_by_role: "student",
  });
  return { appId: app.id, snapshotId, fee };
}

// 1. Camila → Norte/Individual — en revisión.
const app1 = await createApplication({
  student: camila,
  residenceId: norteId,
  roomTypeId: norteIndividualId,
  usd: 300,
  ars: 456000,
  months: 6,
  status: "under_review",
  startDate: "2026-08-01",
});
await admin.from("application_status_events").insert({
  application_request_id: app1.appId,
  from_status: "submitted",
  to_status: "under_review",
  changed_by_role: "residence_owner",
});
console.log("✓ Solicitud 1 — Camila @ Norte/Individual (en revisión):", app1.appId);

// 2. Lucía → Norte/Doble — contacto establecido.
const app2 = await createApplication({
  student: lucia,
  residenceId: norteId,
  roomTypeId: norteDobleId,
  usd: 220,
  ars: 334500,
  months: 6,
  status: "contact_established",
  startDate: "2026-08-15",
  contactEstablished: true,
});
await admin.from("application_status_events").insert([
  { application_request_id: app2.appId, from_status: "submitted", to_status: "under_review", changed_by_role: "residence_owner" },
  { application_request_id: app2.appId, from_status: "under_review", to_status: "contact_established", changed_by_role: "residence_owner" },
]);
console.log("✓ Solicitud 2 — Lucía @ Norte/Doble (contacto establecido):", app2.appId);

// 3. Camila → Río de la Plata/Estudio — propuesta de ajuste pendiente.
const app3 = await createApplication({
  student: camila,
  residenceId: rioplataId,
  roomTypeId: rioplataEstudioId,
  usd: 350,
  ars: 532000,
  months: 4,
  status: "offer_pending_student_acceptance",
  startDate: "2026-09-01",
  contactEstablished: true,
});
await admin.from("application_status_events").insert([
  { application_request_id: app3.appId, from_status: "submitted", to_status: "under_review", changed_by_role: "residence_owner" },
  { application_request_id: app3.appId, from_status: "under_review", to_status: "contact_established", changed_by_role: "residence_owner" },
  { application_request_id: app3.appId, from_status: "contact_established", to_status: "offer_pending_student_acceptance", changed_by_role: "residence_owner" },
]);
const proposedUsd = 320;
await admin.from("application_negotiation_proposals").insert({
  application_request_id: app3.appId,
  sent_by_user_id: ricardoId,
  residence_id: rioplataId,
  proposed_monthly_price_usd: proposedUsd,
  proposed_monthly_price_ars: usdToArs(proposedUsd),
  proposed_duration_months: 6,
  special_conditions: "Podemos extenderte a 6 meses con un pequeño descuento mensual.",
});
console.log("✓ Solicitud 3 — Camila @ Río de la Plata/Estudio (propuesta de ajuste pendiente):", app3.appId);

// 4. Lucía → Río de la Plata/Estudio — loop completo: reserva confirmada + comprobante.
const app4 = await createApplication({
  student: lucia,
  residenceId: rioplataId,
  roomTypeId: rioplataEstudioId,
  usd: 350,
  ars: 532000,
  months: 6,
  status: "converted_to_reservation",
  startDate: "2026-07-20",
  contactEstablished: true,
});
await admin.from("application_status_events").insert([
  { application_request_id: app4.appId, from_status: "submitted", to_status: "under_review", changed_by_role: "residence_owner" },
  { application_request_id: app4.appId, from_status: "under_review", to_status: "contact_established", changed_by_role: "residence_owner" },
  { application_request_id: app4.appId, from_status: "contact_established", to_status: "residence_payment_pending", changed_by_role: "system" },
  { application_request_id: app4.appId, from_status: "residence_payment_pending", to_status: "residence_payment_reported", changed_by_role: "residence_owner" },
  { application_request_id: app4.appId, from_status: "residence_payment_reported", to_status: "converted_to_reservation", changed_by_role: "system" },
]);
const { data: erp4 } = await admin
  .from("external_residence_payments")
  .insert({
    application_request_id: app4.appId,
    residence_id: rioplataId,
    student_profile_id: lucia.profileId,
    status: "reported_received_by_residence",
    amount_reported_usd: 350,
    amount_reported_ars: usdToArs(350),
    payment_method_to_residence: "transfer",
    reported_received_by_user_id: ricardoId,
    reported_received_at: new Date().toISOString(),
  })
  .select("id")
  .single();
const { data: reservation4 } = await admin
  .from("reservations")
  .insert({
    application_request_id: app4.appId,
    student_profile_id: lucia.profileId,
    residence_id: rioplataId,
    room_type_id: rioplataEstudioId,
    status: "confirmed",
    start_date: "2026-07-20",
    initial_duration_months: 6,
    academic_objective: lucia.academicObjective,
    snapshot_id: app4.snapshotId,
    external_residence_payment_id: erp4.id,
    confirmed_at: new Date().toISOString(),
  })
  .select("id")
  .single();
await admin.from("external_residence_payments").update({ reservation_id: reservation4.id }).eq("id", erp4.id);
const { data: feePayment4 } = await admin
  .from("estured_fee_payments")
  .insert({
    reservation_id: reservation4.id,
    payer_user_id: lucia.userId,
    beneficiary_student_profile_id: lucia.profileId,
    status: "paid",
    fee_base_usd: app4.fee.feeBaseUsd,
    fee_base_ars: app4.fee.feeBaseArs,
    fee_amount_ars: app4.fee.estimatedFeeArs,
    payment_currency: "ARS",
    payment_provider: "manual",
    payer_billing_name: "Lucia Fernandez",
    payer_iva_condition: "consumidor_final",
    payment_channel: "transfer",
    paid_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
    fiscal_invoice_status: "pending_issue",
  })
  .select("id")
  .single();
await admin.from("reservations").update({ estured_fee_payment_id: feePayment4.id }).eq("id", reservation4.id);
const verificationCode4 = crypto.randomUUID();
const receiptNumber4 = receiptNumber("ER");
const { data: receipt4 } = await admin
  .from("booking_receipts")
  .insert({
    reservation_id: reservation4.id,
    student_profile_id: lucia.profileId,
    payer_user_id: lucia.userId,
    residence_id: rioplataId,
    status: "issued",
    receipt_number: receiptNumber4,
    verification_code: verificationCode4,
    qr_code_value: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify/${verificationCode4}`,
    issued_at: new Date().toISOString(),
    receipt_payload: {
      reservation_id: reservation4.id,
      student: { first_name: "Lucia", last_initial: "F." },
      residence: { name: "Residencia Río de la Plata", public_area: "Recoleta" },
      room_type: "Individual",
      desired_start_date: "2026-07-20",
      initial_duration_months: 6,
      academic_objective: lucia.academicObjective,
      final_conditions: { monthly_price_usd: 350, enrollment_fee_usd: null, deposit_usd: null },
      residence_payment_confirmed: true,
      estured_fee: {
        amount_ars: app4.fee.estimatedFeeArs,
        amount_usd: null,
        currency: "ARS",
        paid_at: new Date().toISOString(),
      },
      adjustment_policy: "quarterly",
      disclaimer:
        "EstuRed es una plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el alojamiento ni garantiza la conducta de las partes.",
    },
  })
  .select("id")
  .single();
await admin.from("reservations").update({ booking_receipt_id: receipt4.id }).eq("id", reservation4.id);
console.log("✓ Solicitud 4 — Lucía @ Río de la Plata/Estudio → RESERVA CONFIRMADA + comprobante:", receiptNumber4);

// 5. Camila → Norte/Doble — segunda terminal: fee esperando validación del admin.
const app6 = await createApplication({
  student: camila,
  residenceId: norteId,
  roomTypeId: norteDobleId,
  usd: 220,
  ars: 334500,
  months: 5,
  status: "converted_to_reservation",
  startDate: "2026-08-10",
  contactEstablished: true,
});
const { data: erp6 } = await admin
  .from("external_residence_payments")
  .insert({
    application_request_id: app6.appId,
    residence_id: norteId,
    student_profile_id: camila.profileId,
    status: "reported_received_by_residence",
    amount_reported_usd: 220,
    amount_reported_ars: usdToArs(220),
    payment_method_to_residence: "cash",
    reported_received_by_user_id: ricardoId,
    reported_received_at: new Date().toISOString(),
  })
  .select("id")
  .single();
const { data: reservation6 } = await admin
  .from("reservations")
  .insert({
    application_request_id: app6.appId,
    student_profile_id: camila.profileId,
    residence_id: norteId,
    room_type_id: norteDobleId,
    status: "pending_estured_fee",
    start_date: "2026-08-10",
    initial_duration_months: 5,
    academic_objective: camila.academicObjective,
    snapshot_id: app6.snapshotId,
    external_residence_payment_id: erp6.id,
  })
  .select("id")
  .single();
await admin.from("external_residence_payments").update({ reservation_id: reservation6.id }).eq("id", erp6.id);
const { data: feePayment6 } = await admin
  .from("estured_fee_payments")
  .insert({
    reservation_id: reservation6.id,
    payer_user_id: camila.userId,
    beneficiary_student_profile_id: camila.profileId,
    status: "pending_manual_payment",
    fee_base_usd: app6.fee.feeBaseUsd,
    fee_base_ars: app6.fee.feeBaseArs,
    fee_amount_ars: app6.fee.estimatedFeeArs,
    payment_currency: "ARS",
    payment_provider: "manual",
    payer_billing_name: "Camila Rojas",
    payer_iva_condition: "consumidor_final",
    payment_channel: "transfer",
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
  })
  .select("id")
  .single();
await admin.from("reservations").update({ estured_fee_payment_id: feePayment6.id }).eq("id", reservation6.id);
console.log("✓ Solicitud 5 — Camila @ Norte/Doble → fee esperando validación del admin:", app6.appId);

// Lucía queda deliberadamente con 1 sola solicitud activa (app2) — deja margen
// para que el dueño pruebe en vivo el flujo de "enviar solicitud nueva" como
// Lucía y vea aparecer el contador de "nueva(s)" en /residence/dashboard.

// 6. Propuesta del familiar: Martín → Lucía, Norte/Individual — pendiente de aprobación.
const { data: proposal } = await admin
  .from("family_application_proposals")
  .insert({
    family_link_id: luciaLink.id,
    family_member_id: martinFamilyMember.id,
    student_profile_id: lucia.profileId,
    residence_id: norteId,
    room_type_id: norteIndividualId,
    desired_start_date: "2026-09-15",
    initial_duration_months: 6,
    message_to_student: "Vi esta residencia, está cerca de tu facultad y dentro del presupuesto. ¿Qué te parece?",
  })
  .select("id")
  .single();
console.log("✓ Propuesta del familiar — Martín → Lucía @ Norte/Individual (pendiente):", proposal.id);

// ==== Helper de auditoría (mismas columnas que lib/audit.ts — el script
// no puede importar módulos "server-only" fuera de Next, así que se
// replica el insert directo). ====
async function logAudit({ actorUserId, actorRole, action, entityType, entityId, reasonText, newValue, source = "user" }) {
  await admin.from("audit_logs").insert({
    actor_user_id: actorUserId,
    actor_role: actorRole,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: null,
    new_value: newValue ?? null,
    reason_code: null,
    reason_text: reasonText ?? null,
    ip_address: null,
    user_agent: null,
    is_system_action: false,
    source,
  });
}

// ==== 7. Renovación CONFIRMADA: Lucía @ Río de la Plata (sobre la reserva 4) ====
// Mismo escenario verificado en vivo el 2026-07-11 (Ciclo 30bis, comprobante
// ERR-2026-DD7CA0) — se incorpora tal cual al dataset permanente.
const renewal7Fee = feeEstimate(350, 6);
const { data: renewalRequest7 } = await admin
  .from("renewal_requests")
  .insert({
    reservation_id: reservation4.id,
    student_profile_id: lucia.profileId,
    residence_id: rioplataId,
    message: "Me gustaría quedarme otros 6 meses más, ¿tienen disponibilidad?",
    desired_duration_months: 6,
    status: "offer_received",
  })
  .select("id")
  .single();
const { data: renewalOffer7 } = await admin
  .from("renewal_offers")
  .insert({
    reservation_id: reservation4.id,
    renewal_request_id: renewalRequest7.id,
    student_profile_id: lucia.profileId,
    residence_id: rioplataId,
    status: "confirmed",
    // H05: el período arranca justo donde termina el contrato original
    // (reserva 4: 2026-07-20 + 6 meses = 2027-01-20), sin superposición.
    period_start_date: "2027-01-20",
    period_end_date: "2027-07-20",
    duration_months: 6,
    monthly_price_usd: 350,
    monthly_price_ars: usdToArs(350),
    adjustment_policy: "quarterly",
    fee_base_usd: renewal7Fee.feeBaseUsd,
    fee_base_ars: renewal7Fee.feeBaseArs,
    estimated_estured_fee_ars: renewal7Fee.estimatedFeeArs,
    acceptance_deadline_at: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
    sent_by_user_id: ricardoId,
    accepted_at: new Date().toISOString(),
  })
  .select("id")
  .single();
const { data: renewalPayment7 } = await admin
  .from("external_residence_payments")
  .insert({
    renewal_offer_id: renewalOffer7.id,
    reservation_id: reservation4.id,
    residence_id: rioplataId,
    student_profile_id: lucia.profileId,
    status: "reported_received_by_residence",
    amount_reported_usd: 350,
    amount_reported_ars: usdToArs(350),
    payment_method_to_residence: "transfer",
    reported_received_by_user_id: ricardoId,
    reported_received_at: new Date().toISOString(),
  })
  .select("id")
  .single();
const { data: renewalFeePayment7 } = await admin
  .from("estured_fee_payments")
  .insert({
    renewal_offer_id: renewalOffer7.id,
    payer_user_id: lucia.userId,
    beneficiary_student_profile_id: lucia.profileId,
    status: "paid",
    fee_base_usd: renewal7Fee.feeBaseUsd,
    fee_base_ars: renewal7Fee.feeBaseArs,
    fee_amount_ars: renewal7Fee.estimatedFeeArs,
    payment_currency: "ARS",
    payment_provider: "manual",
    payer_billing_name: "Lucia Fernandez",
    payer_iva_condition: "consumidor_final",
    payment_channel: "transfer",
    paid_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
    fiscal_invoice_status: "pending_issue",
  })
  .select("id")
  .single();
const renewalVerificationCode7 = crypto.randomUUID();
const renewalReceiptNumber7 = receiptNumber("ERR");
const { data: renewalReceipt7 } = await admin
  .from("renewal_receipts")
  .insert({
    renewal_offer_id: renewalOffer7.id,
    status: "issued",
    receipt_number: renewalReceiptNumber7,
    verification_code: renewalVerificationCode7,
    qr_code_value: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify/${renewalVerificationCode7}`,
    issued_at: new Date().toISOString(),
    receipt_payload: {
      renewal_offer_id: renewalOffer7.id,
      reservation_id: reservation4.id,
      student: { first_name: "Lucia", last_initial: "F." },
      residence: { name: "Residencia Río de la Plata", public_area: "Recoleta" },
      period_start_date: "2027-01-20",
      period_end_date: "2027-07-20",
      duration_months: 6,
      monthly_price_usd: 350,
      monthly_price_ars: usdToArs(350),
      adjustment_policy: "quarterly",
      residence_payment_confirmed: true,
      estured_fee: { amount_ars: renewal7Fee.estimatedFeeArs, currency: "ARS", paid_at: new Date().toISOString() },
      disclaimer:
        "EstuRed es una plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el alojamiento ni garantiza la conducta de las partes.",
    },
  })
  .select("id")
  .single();
await admin
  .from("renewal_offers")
  .update({
    external_residence_payment_id: renewalPayment7.id,
    estured_fee_payment_id: renewalFeePayment7.id,
    renewal_receipt_id: renewalReceipt7.id,
  })
  .eq("id", renewalOffer7.id);
console.log("✓ Renovación 1 — Lucía @ Río de la Plata → CONFIRMADA + comprobante:", renewalReceiptNumber7);

// ==== 8. Camila @ Norte/Individual — 2da reserva confirmada, con comprobante
// reemitido por el admin y una renovación con OFERTA ENVIADA (sin responder). ====
const app8 = await createApplication({
  student: camila,
  residenceId: norteId,
  roomTypeId: norteIndividualId,
  usd: 300,
  ars: 456000,
  months: 6,
  status: "converted_to_reservation",
  startDate: "2026-02-01",
  contactEstablished: true,
});
const { data: erp8 } = await admin
  .from("external_residence_payments")
  .insert({
    application_request_id: app8.appId,
    residence_id: norteId,
    student_profile_id: camila.profileId,
    status: "reported_received_by_residence",
    amount_reported_usd: 300,
    amount_reported_ars: usdToArs(300),
    payment_method_to_residence: "transfer",
    reported_received_by_user_id: ricardoId,
    reported_received_at: new Date().toISOString(),
  })
  .select("id")
  .single();
const { data: reservation8 } = await admin
  .from("reservations")
  .insert({
    application_request_id: app8.appId,
    student_profile_id: camila.profileId,
    residence_id: norteId,
    room_type_id: norteIndividualId,
    status: "confirmed",
    start_date: "2026-02-01",
    initial_duration_months: 6,
    academic_objective: camila.academicObjective,
    snapshot_id: app8.snapshotId,
    external_residence_payment_id: erp8.id,
    confirmed_at: new Date().toISOString(),
  })
  .select("id")
  .single();
await admin.from("external_residence_payments").update({ reservation_id: reservation8.id }).eq("id", erp8.id);
const { data: feePayment8 } = await admin
  .from("estured_fee_payments")
  .insert({
    reservation_id: reservation8.id,
    payer_user_id: camila.userId,
    beneficiary_student_profile_id: camila.profileId,
    status: "paid",
    fee_base_usd: app8.fee.feeBaseUsd,
    fee_base_ars: app8.fee.feeBaseArs,
    fee_amount_ars: app8.fee.estimatedFeeArs,
    payment_currency: "ARS",
    payment_provider: "manual",
    payer_billing_name: "Camila Rojas",
    payer_iva_condition: "consumidor_final",
    payment_channel: "transfer",
    paid_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
    fiscal_invoice_status: "pending_issue",
  })
  .select("id")
  .single();
await admin.from("reservations").update({ estured_fee_payment_id: feePayment8.id }).eq("id", reservation8.id);
const originalCode8 = crypto.randomUUID();
const originalReceiptNumber8 = receiptNumber("ER");
const receiptPayload8 = {
  reservation_id: reservation8.id,
  student: { first_name: "Camila", last_initial: "R." },
  residence: { name: "Residencia Norte", public_area: "Palermo" },
  room_type: "Individual",
  desired_start_date: "2026-02-01",
  initial_duration_months: 6,
  academic_objective: camila.academicObjective,
  final_conditions: { monthly_price_usd: 300 },
  residence_payment_confirmed: true,
  estured_fee: { amount_ars: app8.fee.estimatedFeeArs, currency: "ARS", paid_at: new Date().toISOString() },
  disclaimer:
    "EstuRed es una plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el alojamiento ni garantiza la conducta de las partes.",
};
const { data: originalReceipt8 } = await admin
  .from("booking_receipts")
  .insert({
    reservation_id: reservation8.id,
    student_profile_id: camila.profileId,
    payer_user_id: camila.userId,
    residence_id: norteId,
    status: "reissued",
    receipt_number: originalReceiptNumber8,
    verification_code: originalCode8,
    qr_code_value: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify/${originalCode8}`,
    issued_at: new Date().toISOString(),
    receipt_payload: receiptPayload8,
  })
  .select("id")
  .single();
const reissuedCode8 = crypto.randomUUID();
const reissuedReceiptNumber8 = receiptNumber("ER");
const { data: reissuedReceipt8 } = await admin
  .from("booking_receipts")
  .insert({
    reservation_id: reservation8.id,
    student_profile_id: camila.profileId,
    payer_user_id: camila.userId,
    residence_id: norteId,
    status: "issued",
    receipt_number: reissuedReceiptNumber8,
    verification_code: reissuedCode8,
    qr_code_value: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify/${reissuedCode8}`,
    issued_at: new Date().toISOString(),
    reissued_from_receipt_id: originalReceipt8.id,
    receipt_payload: { ...receiptPayload8, issued_at: new Date().toISOString() },
  })
  .select("id")
  .single();
await admin.from("reservations").update({ booking_receipt_id: reissuedReceipt8.id }).eq("id", reservation8.id);
const adminUserId = await userIdByEmail("admin.operaciones@estured.test");
await logAudit({
  actorUserId: adminUserId,
  actorRole: "admin",
  action: "booking_receipt_reissued",
  entityType: "booking_receipts",
  entityId: originalReceipt8.id,
  reasonText: "El estudiante pidió el comprobante con el apellido completo corregido.",
  newValue: { new_receipt_id: reissuedReceipt8.id, new_receipt_number: reissuedReceiptNumber8 },
  source: "admin",
});
console.log("✓ Solicitud 6 — Camila @ Norte/Individual → RESERVA CONFIRMADA, comprobante reemitido:", reissuedReceiptNumber8, "(anterior:", originalReceiptNumber8 + ")");

// Renovación de Camila sobre reservation8 — DESACTIVADA a pedido del
// dueño (Ciclo 39): quiere poder iniciar una renovación desde cero con
// Camila para probar en vivo el modal "Iniciar renovación" del lado del
// estudiante, así que esta reserva ya no arranca con una oferta
// pendiente. Se deja el bloque comentado (no borrado) como referencia
// de cómo sembrar una oferta ENVIADA para probar Aceptar/Rechazar más
// adelante si hace falta.
//
// const renewal8Fee = feeEstimate(310, 6);
// const { data: renewalRequest8 } = await admin
//   .from("renewal_requests")
//   .insert({
//     reservation_id: reservation8.id,
//     student_profile_id: camila.profileId,
//     residence_id: norteId,
//     message: "Quisiera renovar por 6 meses más si es posible.",
//     desired_duration_months: 6,
//     status: "offer_received",
//   })
//   .select("id")
//   .single();
// const { data: renewalOffer8 } = await admin
//   .from("renewal_offers")
//   .insert({
//     reservation_id: reservation8.id,
//     renewal_request_id: renewalRequest8.id,
//     student_profile_id: camila.profileId,
//     residence_id: norteId,
//     status: "sent",
//     period_start_date: "2026-08-01",
//     period_end_date: "2027-02-01",
//     duration_months: 6,
//     monthly_price_usd: 310,
//     monthly_price_ars: usdToArs(310),
//     adjustment_policy: "quarterly",
//     fee_base_usd: renewal8Fee.feeBaseUsd,
//     fee_base_ars: renewal8Fee.feeBaseArs,
//     estimated_estured_fee_ars: renewal8Fee.estimatedFeeArs,
//     acceptance_deadline_at: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
//     sent_by_user_id: ricardoId,
//   })
//   .select("id")
//   .single();
// console.log("✓ Renovación 2 — Camila @ Norte/Individual → OFERTA ENVIADA, esperando respuesta:", renewalOffer8.id);
console.log("(renovación de Camila sobre reservation8 desactivada a propósito — ver comentario arriba)");

// ==== 9. Camila @ Norte/Doble — 3ra reserva confirmada, fee pagado y luego
// REVOCADA por la estudiante (botón de arrepentimiento, docs/10 §15.4) ====
const app9 = await createApplication({
  student: camila,
  residenceId: norteId,
  roomTypeId: norteDobleId,
  usd: 220,
  ars: 334500,
  months: 4,
  status: "converted_to_reservation",
  startDate: "2026-06-01",
  contactEstablished: true,
});
const { data: erp9 } = await admin
  .from("external_residence_payments")
  .insert({
    application_request_id: app9.appId,
    residence_id: norteId,
    student_profile_id: camila.profileId,
    status: "reported_received_by_residence",
    amount_reported_usd: 220,
    amount_reported_ars: usdToArs(220),
    payment_method_to_residence: "cash",
    reported_received_by_user_id: ricardoId,
    reported_received_at: new Date().toISOString(),
  })
  .select("id")
  .single();
const { data: reservation9 } = await admin
  .from("reservations")
  .insert({
    application_request_id: app9.appId,
    student_profile_id: camila.profileId,
    residence_id: norteId,
    room_type_id: norteDobleId,
    status: "confirmed",
    start_date: "2026-06-01",
    initial_duration_months: 4,
    academic_objective: camila.academicObjective,
    snapshot_id: app9.snapshotId,
    external_residence_payment_id: erp9.id,
    confirmed_at: new Date().toISOString(),
  })
  .select("id")
  .single();
await admin.from("external_residence_payments").update({ reservation_id: reservation9.id }).eq("id", erp9.id);
const { data: feePayment9 } = await admin
  .from("estured_fee_payments")
  .insert({
    reservation_id: reservation9.id,
    payer_user_id: camila.userId,
    beneficiary_student_profile_id: camila.profileId,
    status: "paid",
    fee_base_usd: app9.fee.feeBaseUsd,
    fee_base_ars: app9.fee.feeBaseArs,
    fee_amount_ars: app9.fee.estimatedFeeArs,
    payment_currency: "ARS",
    payment_provider: "manual",
    payer_billing_name: "Camila Rojas",
    payer_iva_condition: "consumidor_final",
    payment_channel: "transfer",
    paid_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
    fiscal_invoice_status: "pending_issue",
  })
  .select("id")
  .single();
await admin.from("reservations").update({ estured_fee_payment_id: feePayment9.id }).eq("id", reservation9.id);
const code9 = crypto.randomUUID();
const receiptNumber9 = receiptNumber("ER");
const { data: receipt9 } = await admin
  .from("booking_receipts")
  .insert({
    reservation_id: reservation9.id,
    student_profile_id: camila.profileId,
    payer_user_id: camila.userId,
    residence_id: norteId,
    status: "voided",
    receipt_number: receiptNumber9,
    verification_code: code9,
    qr_code_value: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify/${code9}`,
    issued_at: new Date().toISOString(),
    voided_at: new Date().toISOString(),
    receipt_payload: {
      reservation_id: reservation9.id,
      student: { first_name: "Camila", last_initial: "R." },
      residence: { name: "Residencia Norte", public_area: "Palermo" },
      room_type: "Doble",
      desired_start_date: "2026-06-01",
      initial_duration_months: 4,
      academic_objective: camila.academicObjective,
      final_conditions: { monthly_price_usd: 220 },
      residence_payment_confirmed: true,
      estured_fee: { amount_ars: app9.fee.estimatedFeeArs, currency: "ARS", paid_at: new Date().toISOString() },
      disclaimer:
        "EstuRed es una plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el alojamiento ni garantiza la conducta de las partes.",
    },
  })
  .select("id")
  .single();
await admin.from("reservations").update({ booking_receipt_id: receipt9.id }).eq("id", reservation9.id);
await admin
  .from("reservations")
  .update({
    status: "cancelled_by_student",
    cancellation_reason_code: "student_revocation_right",
    cancelled_at: new Date().toISOString(),
  })
  .eq("id", reservation9.id);
await logAudit({
  actorUserId: camila.userId,
  actorRole: "student",
  action: "estured_fee_revoked",
  entityType: "reservations",
  entityId: reservation9.id,
  reasonText: "Conseguí un lugar más cerca de la facultad y no voy a poder mudarme acá.",
  newValue: { estured_fee_payment_id: feePayment9.id, days_since_paid: 2 },
  source: "user",
});
console.log("✓ Solicitud 7 — Camila @ Norte/Doble → REVOCADA (botón de arrepentimiento):", reservation9.id);

// ==== 10. Propuestas del familiar RECHAZADAS x2 (Martín → Lucía) — para
// probar la alerta "familiares con 2+ propuestas rechazadas" en
// /admin/family-proposals (docs/08 §8.7). ====
async function createRejectedProposal({ residenceId, roomTypeId, startDate, months, message, reason }) {
  await admin.from("family_application_proposals").insert({
    family_link_id: luciaLink.id,
    family_member_id: martinFamilyMember.id,
    student_profile_id: lucia.profileId,
    residence_id: residenceId,
    room_type_id: roomTypeId,
    desired_start_date: startDate,
    initial_duration_months: months,
    status: "rejected_by_student",
    message_to_student: message,
    rejection_reason: reason,
    student_response_at: new Date().toISOString(),
    student_response_by_user_id: lucia.userId,
  });
}
await createRejectedProposal({
  residenceId: norteId,
  roomTypeId: norteDobleId,
  startDate: "2026-08-01",
  months: 6,
  message: "Esta otra habitación en Norte también está buena, ¿la vemos?",
  reason: "Prefiero seguir buscando algo más cerca de mi facultad.",
});
await createRejectedProposal({
  residenceId: rioplataId,
  roomTypeId: rioplataEstudioId,
  startDate: "2026-09-01",
  months: 6,
  message: "Vi este estudio en Río de la Plata, parece cómodo para vos sola.",
  reason: "El precio no entra en el presupuesto que hablamos.",
});
console.log("✓ 2 propuestas del familiar rechazadas (Martín → Lucía) — dispara la alerta de repetidas en /admin/family-proposals");

// ==== 11. Waitlist pública — algunos leads para /admin/dashboard ====
const waitlistLeads = [
  { role: "student", name: "Julieta Gómez", email: "julieta.gomez@example.com", city: "Rosario", message: "Busco para marzo 2027." },
  { role: "family", name: "Roberto Díaz", email: "roberto.diaz@example.com", city: "Mendoza", message: "Mi hija empieza la facultad el año que viene." },
  { role: "residence", name: "Marina Suárez", email: "marina.suarez@example.com", city: "CABA", message: "Tengo una casa en Belgrano, ¿cómo la publico?" },
];
// El índice único real es sobre lower(email) (migración 0001), no sobre
// la columna "email" en sí — upsert con onConflict:"email" no matchea
// ningún constraint real y falla en silencio (42P10) si no se revisa el
// error. Delete-then-insert por email es más simple y sigue el mismo
// patrón de idempotencia que el resto del script.
for (const lead of waitlistLeads) {
  const { error: delError } = await admin.from("waitlist_signups").delete().ilike("email", lead.email);
  if (delError) console.error("[seed] waitlist delete failed:", lead.email, delError.message);
  const { error: insError } = await admin
    .from("waitlist_signups")
    .insert({ ...lead, privacy_consent_at: new Date().toISOString() });
  if (insError) console.error("[seed] waitlist insert failed:", lead.email, insError.message);
}
console.log(`✓ ${waitlistLeads.length} leads de waitlist (para el contador de /admin/dashboard)`);

// ==== 12. Fase 5.1 — Disponibilidad + lista de espera por residencia ====
// Norte/Doble: SIN LUGAR (para probar el CTA "Sumarme a lista de espera"
// en la ficha real y el flujo completo de lista de espera).
await admin.from("profile_availability").update({ status: "full", available_count: 0 }).eq("room_type_id", norteDobleId);
const { data: camilaWaitlistEntry } = await admin
  .from("waitlist_entries")
  .insert({
    student_profile_id: camila.profileId,
    residence_id: norteId,
    room_type_id: norteDobleId,
    desired_start_date: "2026-09-01",
    desired_duration_months: 6,
    status: "active",
  })
  .select("id")
  .single();
console.log("✓ Camila @ Norte/Doble → EN LISTA DE ESPERA (habitación sin lugar):", camilaWaitlistEntry?.id);

// Norte/Individual: SIN ACTUALIZAR hace más de 30 días (para ver el badge
// "Sin actualizar" en /residence/.../availability sin esperar al job real).
const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 3_600_000).toISOString();
await admin
  .from("profile_availability")
  .update({ status: "not_updated", last_confirmed_at: fortyDaysAgo })
  .eq("room_type_id", norteIndividualId);
console.log("✓ Norte/Individual → disponibilidad SIN ACTUALIZAR (40 días)");

// Lucía → lista de espera de Norte/Individual, ya AVISADA de que hay
// lugar (para probar "Activar solicitud"/"Quedarme en lista" en vivo,
// con el happy path completo — activar SÍ debe funcionar acá).
// Con Casa Compartida Almagro no alcanzaba: es `pending_verification`,
// y RLS (residences_select_public, migración 0003) solo deja ver
// residencias `verified_active` a quien no es owner/staff — un
// estudiante real nunca llega a sumarse a la espera de una residencia
// no publicada. Con Norte/Doble tampoco (aunque es verified_active):
// esa habitación queda "sin lugar" a propósito para la historia de
// Camila, y `activateFromWaitlist` valida la disponibilidad REAL de la
// habitación (no solo el flag de "avisado") — activar ahí fallaría con
// "esa habitación todavía no tiene lugar", un hallazgo real de que
// notificar y actualizar disponibilidad son dos acciones independientes
// a propósito (evita confiar en un aviso que puede quedar desactualizado).
// Norte/Individual está "sin actualizar" (not_updated) pero NO full, así
// que activar sí funciona. Lucía tiene 1 sola solicitud activa
// (Solicitud 2), así que puede activar esta sin chocar con el límite de 2.
const { data: luciaWaitlistEntry } = await admin
  .from("waitlist_entries")
  .insert({
    student_profile_id: lucia.profileId,
    residence_id: norteId,
    room_type_id: norteIndividualId,
    desired_start_date: "2026-10-01",
    desired_duration_months: 4,
    status: "availability_notification_sent",
  })
  .select("id")
  .single();
console.log("✓ Lucía @ Norte/Individual → AVISADA de disponibilidad:", luciaWaitlistEntry?.id);

// ==== 13. Fase 5.3 acotada — residentes + comunidad visible ====
// Lucía → residente ACTIVO en Río de la Plata (vinculada a su reserva
// confirmada real, reservation4), con el perfil visible habilitado y
// algunos campos mostrados a usuarios registrados — para que
// /residencias/residencia-rio-de-la-plata-demo/comunidad tenga una
// tarjeta real que mostrar, no solo placeholders.
const { data: luciaResidentStay } = await admin
  .from("resident_stays")
  .insert({
    student_profile_id: lucia.profileId,
    residence_id: rioplataId,
    room_type_id: rioplataEstudioId,
    reservation_id: reservation4.id,
    created_by_residence_user_id: ricardoId,
    invite_email: (await admin.from("users").select("email").eq("id", lucia.userId).single()).data.email,
    status: "active",
    start_date: "2026-07-20",
    // Contrato hasta el fin de su renovación confirmada (renewalOffer7),
    // como lo dejaría extendResidentStayOnRenewal en el flujo real.
    expected_end_date: "2027-07-20",
  })
  .select("id")
  .single();
await admin
  .from("student_visibility_settings")
  .update({
    is_individual_profile_visible: true,
    show_age_to_registered: true,
    show_nationality_to_registered: true,
    show_career_to_registered: true,
  })
  .eq("student_profile_id", lucia.profileId);
console.log("✓ Lucía @ Río de la Plata → RESIDENTE ACTIVO en comunidad visible:", luciaResidentStay?.id);

// Camila → residente PENDIENTE DE ACTIVAR en Norte (vinculada a su
// reserva confirmada real, reservation6, pero sin student_profile_id
// todavía — demuestra la tarjeta "Residente pendiente de activar
// cuenta" incluso cuando la reserva ya está confirmada).
const { data: camilaResidentStay } = await admin
  .from("resident_stays")
  .insert({
    residence_id: norteId,
    room_type_id: norteDobleId,
    reservation_id: reservation6.id,
    created_by_residence_user_id: ricardoId,
    invite_email: (await admin.from("users").select("email").eq("id", camila.userId).single()).data.email,
    status: "pending_activation",
    start_date: "2026-08-10",
  })
  .select("id")
  .single();
console.log("✓ Camila @ Norte → RESIDENTE PENDIENTE de activar cuenta:", camilaResidentStay?.id);

// Residente cargado manualmente por la residencia, SIN reserva de
// EstuRed (docs/05 §15.1 — "llegó por fuera de la plataforma").
const { data: manualResidentStay } = await admin
  .from("resident_stays")
  .insert({
    residence_id: norteId,
    room_type_id: norteIndividualId,
    created_by_residence_user_id: ricardoId,
    invite_email: "residente.externo@example.com",
    status: "pending_activation",
    start_date: "2026-06-01",
  })
  .select("id")
  .single();
console.log("✓ Residente externo (sin reserva de EstuRed) cargado en Norte:", manualResidentStay?.id);

console.log("\nSeed de datos demo completo. Residencias reales: Norte, Río de la Plata (verificadas) + Almagro (pendiente).");
console.log("Login con DEMO_LOGIN_ENABLED=true y el widget 'Simular sesión' en la esquina inferior izquierda.");
