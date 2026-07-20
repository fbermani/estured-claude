/**
 * Seed de camas + condiciones de reserva (Ciclo 34duovicies — requiere
 * la migración 0025 aplicada).
 *
 *  1. Condiciones por residencia (variedad para demo, respetando la
 *     exclusión matrícula/depósito):
 *      - Río de la Plata: matrícula = 1 mes (única vez), mes vacío 25%
 *        de descuento (cobra 75%, como la referencia), mínimo 3 meses.
 *      - Norte: DEPÓSITO USD 300 (sin matrícula), mes vacío 50%, mínimo 6.
 *      - Almagro: matrícula manual USD 150 anual, sin mes vacío, sin mínimo.
 *  2. Camas por habitación (letras A..capacidad) para todas las
 *     habitaciones activas.
 *  3. Asigna cada estadía con habitación a una cama libre de ESA
 *     habitación.
 *  4. Fechas de salida demo (algunas dentro de 30 días → "Por salir"),
 *     un par de tarifas personalizadas, y 2 camas fuera de servicio en
 *     Norte (una en habitación vacía → card "Mantenimiento").
 *
 * Uso: node --env-file=.env.local scripts/seed-beds-and-conditions.mjs
 * Idempotente.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const BED_LETTERS = "ABCDEFGHIJ";
const RIO_SLUG = "residencia-rio-de-la-plata-demo";
const NORTE_SLUG = "residencia-norte-demo";
const ALMAGRO_SLUG = "casa-almagro-demo";

const CONDITIONS_BY_SLUG = {
  [RIO_SLUG]: {
    label: "Residencia Río de la Plata",
    minimum_stay_months: 3,
    adjustment_policy: "quarterly",
    enrollment_fee_mode: "one_month",
    enrollment_fee_usd: null,
    enrollment_fee_frequency: "once",
    deposit_usd: null,
    empty_month_charge_percent: 75,
  },
  [NORTE_SLUG]: {
    label: "Residencia Norte",
    minimum_stay_months: 6,
    adjustment_policy: "quarterly",
    enrollment_fee_mode: null,
    enrollment_fee_usd: null,
    enrollment_fee_frequency: "once",
    deposit_usd: 300,
    empty_month_charge_percent: 50,
  },
  [ALMAGRO_SLUG]: {
    label: "Casa Compartida Almagro",
    minimum_stay_months: null,
    adjustment_policy: "semiannual",
    enrollment_fee_mode: "manual",
    enrollment_fee_usd: 150,
    enrollment_fee_frequency: "annual",
    deposit_usd: null,
    empty_month_charge_percent: null,
  },
};

function isoDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

async function main() {
  // Resolver slug -> id real (nunca hardcodear IDs: se rompen en silencio
  // si la residencia se recrea con un id nuevo — ver MEMORY.md, Ciclo
  // 34unodevicies-octies).
  const { data: residenceRows, error: residencesError } = await admin
    .from("residences")
    .select("id, slug")
    .in("slug", Object.keys(CONDITIONS_BY_SLUG));
  if (residencesError) throw residencesError;
  const idBySlug = Object.fromEntries((residenceRows ?? []).map((r) => [r.slug, r.id]));
  for (const slug of Object.keys(CONDITIONS_BY_SLUG)) {
    if (!idBySlug[slug]) throw new Error(`No se encontró la residencia con slug "${slug}" — ¿se corrió seed-demo-data.mjs?`);
  }
  const NORTE = idBySlug[NORTE_SLUG];
  const CONDITIONS = Object.fromEntries(
    Object.entries(CONDITIONS_BY_SLUG).map(([slug, value]) => [idBySlug[slug], value]),
  );

  // 1. Condiciones
  for (const [residenceId, { label, ...fields }] of Object.entries(CONDITIONS)) {
    const { error } = await admin.from("residences").update(fields).eq("id", residenceId);
    if (error) throw new Error(`${label}: ${error.message}`);
    console.log(`+ condiciones de ${label}`);
  }

  const residenceIds = Object.keys(CONDITIONS);
  const [{ data: roomTypes }, { data: rooms }, { data: stays }] = await Promise.all([
    admin.from("room_types").select("id, residence_id, capacity_per_room").in("residence_id", residenceIds),
    admin.from("rooms").select("id, residence_id, room_type_id, label").eq("is_active", true).in("residence_id", residenceIds),
    admin
      .from("resident_stays")
      .select("id, residence_id, room_id, bed_id, start_date, expected_end_date, monthly_rate_usd")
      .eq("is_current", true)
      .in("residence_id", residenceIds),
  ]);
  const capacityByType = new Map((roomTypes ?? []).map((t) => [t.id, Math.max(1, t.capacity_per_room ?? 1)]));

  // 2. Camas por habitación
  const { data: existingBeds } = await admin
    .from("beds")
    .select("id, room_id, letter, status")
    .in("room_id", (rooms ?? []).map((r) => r.id));
  const bedsByRoom = new Map();
  for (const bed of existingBeds ?? []) {
    const list = bedsByRoom.get(bed.room_id) ?? [];
    list.push(bed);
    bedsByRoom.set(bed.room_id, list);
  }

  let createdBeds = 0;
  for (const room of rooms ?? []) {
    const capacity = Math.min(BED_LETTERS.length, capacityByType.get(room.room_type_id) ?? 1);
    const existing = new Set((bedsByRoom.get(room.id) ?? []).map((b) => b.letter));
    const missing = [];
    for (let i = 0; i < capacity; i++) {
      if (!existing.has(BED_LETTERS[i])) missing.push({ room_id: room.id, letter: BED_LETTERS[i], sort_order: i });
    }
    if (missing.length > 0) {
      const { data: inserted, error } = await admin.from("beds").insert(missing).select("id, room_id, letter, status");
      if (error) throw error;
      createdBeds += missing.length;
      for (const bed of inserted ?? []) {
        const list = bedsByRoom.get(bed.room_id) ?? [];
        list.push(bed);
        bedsByRoom.set(bed.room_id, list);
      }
    }
  }
  console.log(`+ ${createdBeds} camas creadas`);

  // 3. Asignación de camas dentro de la habitación de cada estadía
  const usedBeds = new Set((stays ?? []).map((s) => s.bed_id).filter(Boolean));
  let assigned = 0;
  for (const stay of stays ?? []) {
    if (stay.bed_id || !stay.room_id) continue;
    const roomBeds = (bedsByRoom.get(stay.room_id) ?? []).sort((a, b) => a.letter.localeCompare(b.letter));
    const free = roomBeds.find((b) => b.status === "active" && !usedBeds.has(b.id));
    if (!free) continue;
    const { error } = await admin.from("resident_stays").update({ bed_id: free.id }).eq("id", stay.id);
    if (error) throw error;
    usedBeds.add(free.id);
    assigned += 1;
  }
  console.log(`+ ${assigned} residentes asignados a cama`);

  // 4a. Fechas de salida + tarifas personalizadas (solo si faltan)
  const pending = (stays ?? []).filter((s) => !s.expected_end_date);
  const endOffsets = [20, 25, 45, 90, 120, 180, 240, 300];
  let datesSet = 0;
  for (let i = 0; i < pending.length; i++) {
    const { error } = await admin
      .from("resident_stays")
      .update({ expected_end_date: isoDaysFromNow(endOffsets[i % endOffsets.length] + (i % 7)) })
      .eq("id", pending[i].id);
    if (!error) datesSet += 1;
  }
  console.log(`+ ${datesSet} fechas de salida demo`);

  const noRate = (stays ?? []).filter((s) => s.monthly_rate_usd == null).slice(0, 2);
  for (const stay of noRate) {
    await admin.from("resident_stays").update({ monthly_rate_usd: 280 }).eq("id", stay.id);
  }
  if (noRate.length > 0) console.log(`+ ${noRate.length} tarifas personalizadas demo (USD 280)`);

  // 4b. Fuera de servicio demo en Norte: una cama libre de una habitación
  // ocupada + la única cama de una habitación vacía (→ "Mantenimiento").
  const norteRooms = (rooms ?? []).filter((r) => r.residence_id === NORTE);
  let oosDone = 0;
  for (const room of norteRooms) {
    if (oosDone >= 2) break;
    const roomBeds = bedsByRoom.get(room.id) ?? [];
    const anyOos = roomBeds.some((b) => b.status === "out_of_service");
    if (anyOos) {
      oosDone += 1;
      continue;
    }
    const freeBeds = roomBeds.filter((b) => b.status === "active" && !usedBeds.has(b.id));
    const occupiedCount = roomBeds.length - freeBeds.length;
    const wantEmptyRoom = oosDone === 1; // segunda marca: habitación entera vacía
    if (!wantEmptyRoom && occupiedCount > 0 && freeBeds.length > 0) {
      await admin
        .from("beds")
        .update({ status: "out_of_service", out_of_service_reason: "Mantenimiento aire acondicionado" })
        .eq("id", freeBeds[0].id);
      console.log(`+ cama ${freeBeds[0].letter} de ${room.label} fuera de servicio`);
      oosDone += 1;
    } else if (wantEmptyRoom && occupiedCount === 0 && freeBeds.length === roomBeds.length && roomBeds.length > 0) {
      await admin
        .from("beds")
        .update({ status: "out_of_service", out_of_service_reason: "En reparación por plomería" })
        .in("id", roomBeds.map((b) => b.id));
      console.log(`+ ${room.label} completa en mantenimiento`);
      oosDone += 1;
    }
  }

  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
