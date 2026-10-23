/**
 * Seed aditivo (Ciclo 55, D19/D3): datos demo para la ficha pública de las 3 residencias demo.
 * No borra ni recrea nada (no cambia ningún UUID). Idempotente: re-correrlo deja los mismos valores.
 *
 * - Disponibilidad coherente: un tipo `available_to_confirm` con `available_count = 0` (pasaba con Norte/Triple)
 *   contradice la regla de producción (`confirmAfterFeePaid` pasa a `full` al llegar a 0): se pasa a `full`.
 * - Coordenadas: puntos aproximados de cada barrio (la ubicación es pública y el mapa muestra el pin; no son la
 *   dirección real de ninguna residencia, que es ficticia).
 * - Dirección: solo si la residencia no tiene una cargada. Es ficticia (demo) y se muestra en la ficha y en el
 *   detalle de solicitud.
 *
 * Requiere la migración 0042 aplicada en la base de desarrollo.
 * Uso: node --env-file=.env.local scripts/seed-demo-ficha.mjs
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

const DEMO = [
  { slug: "residencia-norte-demo", latitude: -34.58142, longitude: -58.42115, address: "Av. Santa Fe 4120, Palermo (demo)" },
  { slug: "residencia-rio-de-la-plata-demo", latitude: -34.58831, longitude: -58.40367, address: "Av. Las Heras 2480, Recoleta (demo)" },
  { slug: "casa-almagro-demo", latitude: -34.60664, longitude: -58.42081, address: "Medrano 650, Almagro (demo)" },
];

for (const d of DEMO) {
  const { data: residence, error: readError } = await admin
    .from("residences")
    .select("id, address_line")
    .eq("slug", d.slug)
    .maybeSingle();
  if (readError) throw readError;
  if (!residence) {
    console.log(`· no existe ${d.slug} (correr antes scripts/seed-demo-data.mjs)`);
    continue;
  }
  // 1) Dirección demo (columna pública `residences.address_line`): solo si no hay una cargada.
  if (!residence.address_line) {
    const { error: addressError } = await admin.from("residences").update({ address_line: d.address }).eq("id", residence.id);
    if (addressError) throw addressError;
    console.log(`✓ ${d.slug}: dirección demo`);
  }
  // 2) Coordenada aproximada (migración 0042).
  const { error } = await admin
    .from("residences")
    .update({ latitude: d.latitude, longitude: d.longitude })
    .eq("id", residence.id);
  if (error) {
    console.error(`✗ ${d.slug}: ${error.message}`);
    console.error("  ¿Está aplicada la migración 0042 (db/migrations/0042_residence_coordinates.sql) en esta base?");
    process.exitCode = 1;
    continue;
  }
  console.log(`✓ ${d.slug}: ${d.latitude}, ${d.longitude}`);
}

// Disponibilidad coherente (D3): sin lugares declarados no puede figurar como "disponible".
const { data: demoResidences } = await admin.from("residences").select("id, slug").in("slug", DEMO.map((d) => d.slug));
for (const r of demoResidences ?? []) {
  const { data: fixed, error } = await admin
    .from("profile_availability")
    .update({ status: "full" })
    .eq("residence_id", r.id)
    .eq("status", "available_to_confirm")
    .eq("available_count", 0)
    .select("room_type_id");
  if (error) throw error;
  if (fixed?.length) console.log(`✓ ${r.slug}: ${fixed.length} tipo(s) disponible(s) sin lugares -> completo`);
}
