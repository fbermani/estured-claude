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
import { createClient } from "@supabase/supabase-js";

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
    // FK circular reservations<->estured_fee_payments/booking_receipts (MEMORY.md §15.10/13/15):
    // anular ambos lados antes de cualquier delete.
    const { data: apps } = await admin.from("application_requests").select("id").eq("residence_id", existing.id);
    const appIds = (apps ?? []).map((a) => a.id);
    if (appIds.length) {
      const { data: reservations } = await admin.from("reservations").select("id").in("application_request_id", appIds);
      const reservationIds = (reservations ?? []).map((r) => r.id);
      if (reservationIds.length) {
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
    await admin.from("application_requests").delete().eq("residence_id", existing.id);
    await admin.from("residences").delete().eq("id", existing.id);
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
async function addRoomType(residenceId, { name, usd, ars, count }) {
  const { data, error } = await admin
    .from("room_types")
    .insert({ residence_id: residenceId, name, monthly_price_usd: usd, monthly_price_ars: ars, adjustment_policy: "quarterly" })
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
const norteIndividualId = await addRoomType(norteId, { name: "Individual", usd: 300, ars: 456000, count: 3 });
const norteDobleId = await addRoomType(norteId, { name: "Doble", usd: 220, ars: 334500, count: 2 });
await addSections(norteId, {
  services: ["WiFi de alta velocidad", "Limpieza semanal de áreas comunes", "Lavadero", "Cocina equipada"],
  universities: ["Universidad de Palermo", "UBA Derecho"],
  rules: "Convivencia respetuosa, silencio después de las 23hs, visitas coordinadas con anticipación.",
});
console.log("✓ Residencia Norte:", norteId);

const rioplataId = await createResidence({
  name: "Residencia Río de la Plata",
  slug: "residencia-rio-de-la-plata-demo",
  publicArea: "Recoleta",
  status: "verified_active",
  tagline: "Estudios independientes",
  description: "Estudios individuales a pasos del Botánico, ideal para quienes buscan más independencia.",
});
await addOwner(rioplataId, ricardoId, "owner");
const rioplataEstudioId = await addRoomType(rioplataId, { name: "Estudio", usd: 350, ars: 532000, count: 2 });
await addSections(rioplataId, {
  services: ["WiFi", "Aire acondicionado", "Seguridad 24hs"],
  universities: ["UBA Medicina", "Universidad Católica Argentina"],
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
await addRoomType(almagroId, { name: "Compartida (3 personas)", usd: 180, ars: 273500, count: 4 });
await addSections(almagroId, {
  services: ["WiFi", "Desayuno incluido"],
  universities: ["UBA Sociales"],
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
const receiptNumber4 = `ER-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
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
      room_type: "Estudio",
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

console.log("\nSeed de datos demo completo. Residencias reales: Norte, Río de la Plata (verificadas) + Almagro (pendiente).");
console.log("Login con DEMO_LOGIN_ENABLED=true y el widget 'Simular sesión' en la esquina inferior izquierda.");
