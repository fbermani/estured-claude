/**
 * Seed ADITIVO para probar DR48 (la residencia abre los documentos de residentes y de solicitantes con el pago a la residencia habilitado).
 * NO borra ni recrea filas existentes. Todo es idempotente: si ya está, no lo vuelve a crear.
 *
 *  1. Camila (Estudiante en Búsqueda) → solicitud a Residencia Norte / Individual en `residence_payment_pending` (si ya tiene una en ese
 *     estado o en `residence_payment_reported` en Norte, la reutiliza), con 3 documentos reales en el bucket `student-documents`:
 *     identidad (PNG), certificado de estudios (PDF) y un «Otro» con requirement_label (PDF).
 *  2. Documentos reales para dos residentes con estadía vigente: Valentina (Norte) y Lucía (Río de la Plata).
 *  3. Staff demo SIN casilleros: staff.sinpermisos@estured.test en Norte (todos los permisos apagados) → ve solo el estado, nunca el link.
 *     (Sofía, staff.norte@estured.test, tiene `payments.residence` pero no `residents.manage`.)
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-residence-documents.mjs [--apply]   (sin --apply solo simula)
 */
import "./_assert-dev-project.mjs";
import { deflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USERS_PASSWORD;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "student-documents";
const NORTE = "1c4daf03-e33f-490d-a0c9-c1e46f8bb82e";
const NORTE_INDIVIDUAL = "07067f59-c07f-4876-99c7-47a8f18c36eb";
const STAFF_EMAIL = "staff.sinpermisos@estured.test";
const say = (m) => console.log(`${APPLY ? "✓" : "·"} ${m}`);

// ---- archivos de muestra generados acá ----
function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** PNG 200x120 con una banda de color (documento de muestra). */
function samplePng() {
  const w = 200, h = 120;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1);
    raw[o] = 0;
    for (let x = 0; x < w; x++) {
      const band = y < 30;
      raw[o + 1 + x * 3] = band ? 30 : 235;
      raw[o + 2 + x * 3] = band ? 90 : 235;
      raw[o + 3 + x * 3] = band ? 110 : 228;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
function samplePdf(title) {
  const stream = `BT /F1 18 Tf 60 740 Td (${title}) Tj ET\nBT /F1 11 Tf 60 710 Td (Documento de muestra - datos demo de EstuRed) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function profileOf(email) {
  const { data: u } = await admin.from("users").select("id").eq("email", email).single();
  const { data: p } = await admin.from("student_profiles").select("id").eq("user_id", u.id).single();
  return { userId: u.id, profileId: p.id };
}

/** Sube un documento si el perfil todavía no tiene uno de ese tipo (y etiqueta). */
async function ensureDoc({ userId, profileId }, type, label, filename, mime, buffer) {
  let q = admin.from("files").select("id").eq("bucket", BUCKET).eq("related_entity_id", profileId).eq("document_type", type);
  q = label ? q.eq("requirement_label", label) : q.is("requirement_label", null);
  const { data: existing } = await q.limit(1);
  if (existing && existing.length > 0) return say(`ya existe ${type}${label ? ` «${label}»` : ""} de ${profileId.slice(0, 8)}`);
  say(`subir ${type}${label ? ` «${label}»` : ""} (${filename}) a ${profileId.slice(0, 8)}`);
  if (!APPLY) return;
  const ext = mime === "application/pdf" ? "pdf" : "png";
  const path = `${profileId}/${type}-${crypto.randomUUID()}.${ext}`;
  const up = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: mime });
  if (up.error) throw up.error;
  const { error } = await admin.from("files").insert({
    owner_user_id: userId,
    related_entity_type: "student_profiles",
    related_entity_id: profileId,
    bucket: BUCKET,
    storage_path: path,
    filename,
    mime_type: mime,
    size_bytes: buffer.length,
    visibility: "private",
    document_type: type,
    ...(label ? { requirement_label: label } : {}),
    status: "uploaded",
    uploaded_by_user_id: userId,
  });
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

// ---- 1. Camila: solicitud en residence_payment_pending + 3 documentos ----
const camila = await profileOf("camila.rojas@example.com");
const { data: existingApp } = await admin
  .from("application_requests")
  .select("id,status")
  .eq("student_profile_id", camila.profileId)
  .eq("residence_id", NORTE)
  .in("status", ["residence_payment_pending", "residence_payment_reported"])
  .limit(1);
if (existingApp && existingApp.length > 0) {
  say(`reutilizo la solicitud de Camila en Norte (${existingApp[0].status}): ${existingApp[0].id}`);
} else {
  say("crear solicitud de Camila → Norte/Individual en residence_payment_pending");
  if (APPLY) {
    const ARS = 1520, usd = 300, months = 6;
    const feeBaseUsd = usd * months;
    const feeBaseArs = feeBaseUsd * ARS;
    const { data: snap, error: se } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: NORTE,
        room_type_id: NORTE_INDIVIDUAL,
        monthly_price_usd: usd,
        monthly_price_ars: usd * ARS,
        exchange_rate_ars_per_usd: ARS,
        exchange_rate_source: "monedapi.ar",
        exchange_rate_date: new Date().toISOString().slice(0, 10),
        initial_duration_months: months,
        deposit_excluded_from_fee: true,
        reservation_payment_amount_usd: usd,
        reservation_payment_amount_ars: usd * ARS,
        adjustment_policy: "quarterly",
        fee_base_usd: feeBaseUsd,
        fee_base_ars: feeBaseArs,
        estimated_estured_fee_ars: Math.round((feeBaseArs * 0.05) / 500) * 500,
      })
      .select("id")
      .single();
    if (se) throw se;
    const now = Date.now();
    const { data: app, error: ae } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: camila.profileId,
        initiated_by: "student",
        contact_target: "student",
        residence_id: NORTE,
        room_type_id: NORTE_INDIVIDUAL,
        status: "residence_payment_pending",
        desired_start_date: "2027-03-01",
        initial_duration_months: months,
        academic_objective: "Realizar intercambio académico por un semestre en CABA.",
        snapshot_original_id: snap.id,
        created_by_user_id: camila.userId,
        contact_established_at: new Date(now).toISOString(),
        payment_deadline_at: new Date(now + 14 * 86_400_000).toISOString(),
        expires_at: new Date(now + 14 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (ae) throw ae;
    await admin.from("application_snapshots").update({ application_request_id: app.id }).eq("id", snap.id);
    await admin.from("application_status_events").insert([
      { application_request_id: app.id, from_status: null, to_status: "submitted", changed_by_user_id: camila.userId, changed_by_role: "student" },
      { application_request_id: app.id, from_status: "submitted", to_status: "under_review", changed_by_role: "residence_owner" },
      { application_request_id: app.id, from_status: "under_review", to_status: "contact_established", changed_by_role: "residence_owner" },
      { application_request_id: app.id, from_status: "contact_established", to_status: "residence_payment_pending", changed_by_role: "residence_owner" },
    ]);
    console.log(`  solicitud ${app.id}`);
  }
}
await ensureDoc(camila, "student_identity", null, "dni-camila-rojas.png", "image/png", samplePng());
await ensureDoc(camila, "student_academic_proof", null, "certificado-estudios.pdf", "application/pdf", samplePdf("Certificado de alumno regular"));
await ensureDoc(camila, "other", "Seguro médico", "seguro-medico.pdf", "application/pdf", samplePdf("Constancia de seguro medico"));

// ---- 2. Residentes con estadía vigente: Valentina (Norte) y Lucía (Río de la Plata) ----
for (const [email, nombre] of [
  ["valentina.sosa@example.com", "valentina-sosa"],
  ["lucia.fernandez@example.com", "lucia-fernandez"],
]) {
  const r = await profileOf(email);
  await ensureDoc(r, "student_identity", null, `dni-${nombre}.png`, "image/png", samplePng());
  await ensureDoc(r, "student_academic_proof", null, `certificado-${nombre}.pdf`, "application/pdf", samplePdf("Certificado de alumno regular"));
}

// ---- 3. Staff sin casilleros en Norte ----
const { data: staffUser } = await admin.from("users").select("id").eq("email", STAFF_EMAIL).maybeSingle();
let staffId = staffUser?.id;
if (!staffId) {
  say(`crear staff ${STAFF_EMAIL} (Auth + users + rol)`);
  if (APPLY) {
    if (!password) throw new Error("Falta DEMO_USERS_PASSWORD");
    const { data: created, error } = await admin.auth.admin.createUser({ email: STAFF_EMAIL, password, email_confirm: true });
    if (error) throw error;
    staffId = created.user.id;
    await admin.from("users").upsert({ id: staffId, email: STAFF_EMAIL, phone: "+54 9 11 5555-0107", primary_role: "residence_staff" });
    await admin.from("user_roles").upsert({ user_id: staffId, role: "residence_staff", scope_type: "global", scope_id: null }, { onConflict: "user_id,role,scope_type,scope_id" });
    await admin.from("consents").insert([
      { user_id: staffId, consent_type: "terms", version: "v0.1-borrador", metadata: { demo: true } },
      { user_id: staffId, consent_type: "privacy", version: "v0.1-borrador", metadata: { demo: true } },
    ]);
  }
} else {
  say(`el staff ${STAFF_EMAIL} ya existe`);
}
if (staffId) {
  const KEYS = ["applications.review_contact", "applications.reject", "payments.residence", "applications.send_adjustment", "operations.rooms_availability", "residents.manage", "renewals.manage", "waitlist.manage", "faq.manage", "profile.edit"];
  const permissions = Object.fromEntries(KEYS.map((k) => [k, false]));
  const { data: link } = await admin.from("residence_users").select("id").eq("residence_id", NORTE).eq("user_id", staffId).maybeSingle();
  if (link) say("el staff ya está vinculado a Norte");
  else {
    say("vincular staff a Residencia Norte con todos los permisos apagados");
    if (APPLY) {
      const { error } = await admin.from("residence_users").insert({ residence_id: NORTE, user_id: staffId, role: "staff", invitation_status: "accepted", permissions });
      if (error) throw error;
    }
  }
}
console.log(APPLY ? "\nListo." : "\nSimulación: nada se escribió. Agregá --apply.");
