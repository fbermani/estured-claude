/**
 * Seed ADITIVO del «Cobro de la reserva» (DR63) para Residencia Norte (demo) en estured-dev.
 * Deja la residencia con «Cobro con medios habilitados» y tres medios aceptados:
 *   - MercadoPago y Transferencia en pesos: datos de cobro APROBADOS (se le ofrecen al estudiante en la solicitud).
 *   - Ualá: solo datos PENDIENTES de aprobación (NO se ofrece: sirve para ver que un medio sin aprobar no aparece).
 * Idempotente: pisa solo las 3 filas de ese trío en esa residencia y los dos campos públicos de `residences`. No borra nada más.
 *
 * Uso (probar primero con --dry-run):
 *   node --env-file=.env.local scripts/seed-demo-reservation-collection.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-demo-reservation-collection.mjs
 *
 * Datos FICTICIOS de DEMO: nunca cargar datos reales desde acá. Se niega a correr contra producción (`_assert-dev-project.mjs`).
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const RESIDENCE_ID = "1c4daf03-e33f-490d-a0c9-c1e46f8bb82e"; // Residencia Norte (demo)
const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { data: residence, error: residenceError } = await admin
  .from("residences")
  .select("id, name, slug, reservation_payment_modes, accepted_payment_methods")
  .eq("id", RESIDENCE_ID)
  .maybeSingle();
if (residenceError) {
  console.error("No pude leer la residencia (¿está aplicada la migración 0102?):", residenceError.message);
  process.exit(1);
}
if (!residence) {
  console.error(`No existe la residencia ${RESIDENCE_ID} en este proyecto.`);
  process.exit(1);
}
console.log(`Residencia: ${residence.name} (${residence.slug})`);
console.log("  antes:", { modes: residence.reservation_payment_modes, accepted: residence.accepted_payment_methods });

const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").maybeSingle();
const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").maybeSingle();
const now = new Date().toISOString();

const rows = [
  {
    residence_id: RESIDENCE_ID,
    method_key: "mercadopago",
    details: "norte.demo.reserva (DEMO: no transfieras dinero real)",
    pending_details: null,
    pending_submitted_at: null,
    approved_by_user_id: adminUser?.id ?? null,
    approved_at: now,
    updated_by_user_id: owner?.id ?? null,
  },
  {
    residence_id: RESIDENCE_ID,
    method_key: "transfer_ars",
    details: "Alias: norte.demo.pesos, titular Residencia Norte (DEMO: no transfieras dinero real)",
    pending_details: null,
    pending_submitted_at: null,
    approved_by_user_id: adminUser?.id ?? null,
    approved_at: now,
    updated_by_user_id: owner?.id ?? null,
  },
  {
    residence_id: RESIDENCE_ID,
    method_key: "uala",
    details: null,
    pending_details: "norte.demo.uala (DEMO: pendiente de aprobación)",
    pending_submitted_at: now,
    approved_by_user_id: null,
    approved_at: null,
    updated_by_user_id: owner?.id ?? null,
  },
];

if (dryRun) {
  console.log("--dry-run: no se escribió nada. Haría:");
  console.log("  residences.reservation_payment_modes = ['enabled_methods']");
  console.log("  residences.accepted_payment_methods  = ['mercadopago','transfer_ars','uala']");
  for (const r of rows) console.log(`  upsert ${r.method_key}: ${r.details ? "aprobado" : "pendiente"}`);
  process.exit(0);
}

const { error: upError } = await admin
  .from("residences")
  .update({ reservation_payment_modes: ["enabled_methods"], accepted_payment_methods: ["mercadopago", "transfer_ars", "uala"] })
  .eq("id", RESIDENCE_ID);
if (upError) {
  console.error("No pude actualizar la residencia:", upError.message);
  process.exit(1);
}
const { error: rowsError } = await admin.from("residence_collection_accounts").upsert(rows, { onConflict: "residence_id,method_key" });
if (rowsError) {
  console.error("No pude cargar los datos de cobro demo:", rowsError.message);
  process.exit(1);
}
console.log("✓ Residencia Norte: cobro con medios habilitados (MercadoPago y transferencia en pesos aprobados; Ualá pendiente).");
