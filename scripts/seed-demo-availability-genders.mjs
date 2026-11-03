/**
 * Demo de disponibilidad por tipo y género (DR33, migración 0075). Para cada tipo de habitación con disponibilidad cargada, crea (o actualiza)
 * una fila por género de sus habitaciones a partir de las camas libres hoy, y recalcula el resumen del tipo (`profile_availability`) con la
 * misma regla que el servidor (`rollupTypeAvailability`). No toca tipos pausados por EstuRed.
 *
 * Uso (dev; necesita la migración 0075 aplicada):
 *   node --env-file=.env.local scripts/seed-demo-availability-genders.mjs            # un valor por género según camas libres
 *   node --env-file=.env.local scripts/seed-demo-availability-genders.mjs --varied   # en los tipos con 2+ géneros, el último queda «completa» (se ve el estado por género en la ficha)
 *
 * Ojo: deja los tipos como «disponibles» y visibles en búsquedas (pisa la demo de seed-demo-stale-availability). Re-correrlo es seguro: usa upsert por (tipo, género) y no recrea filas con UUID nuevo (no rompe scripts con IDs fijos).
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
const varied = process.argv.includes("--varied");
const ORDER = ["masculino", "femenino", "mixto", "sin_especificar"];
const OCCUPYING = ["created_by_residence", "pending_activation", "active", "visibility_limited"];

function defaultGender(policy, capacity) {
  if (policy === "solo_hombres") return "masculino";
  if (policy === "solo_mujeres") return "femenino";
  if (policy === "mixto") return "mixto";
  return Number(capacity ?? 1) > 1 ? "mixto" : "sin_especificar";
}

const probe = await admin.from("profile_availability_genders").select("id", { head: true, count: "exact" });
if (probe.error) {
  console.error(`✗ Falta la migración 0075 en este proyecto (${probe.error.message}). Aplicala primero en el SQL Editor de estured-dev.`);
  process.exit(1);
}

const { data: types } = await admin
  .from("room_types")
  .select("id, residence_id, name, gender_policy, capacity_per_room, profile_availability(id, status)")
  .eq("is_active", true);

let done = 0;
for (const type of types ?? []) {
  const availability = type.profile_availability;
  if (!availability || availability.status === "paused_by_admin") continue;

  const { data: rooms } = await admin.from("rooms").select("*").eq("room_type_id", type.id).eq("is_active", true);
  const roomIds = (rooms ?? []).map((r) => r.id);
  const { data: beds } = roomIds.length ? await admin.from("beds").select("id, room_id, status").in("room_id", roomIds) : { data: [] };
  const bedIds = (beds ?? []).map((b) => b.id);
  const { data: stays } = bedIds.length
    ? await admin.from("resident_stays").select("bed_id").in("bed_id", bedIds).eq("is_current", true).in("status", OCCUPYING)
    : { data: [] };
  const occupied = new Set((stays ?? []).map((s) => s.bed_id));

  const freeByGender = new Map();
  for (const room of rooms ?? []) {
    const own = room.gender && room.gender !== "sin_especificar" ? room.gender : defaultGender(type.gender_policy, type.capacity_per_room);
    const free = (beds ?? []).filter((b) => b.room_id === room.id && b.status === "active" && !occupied.has(b.id)).length;
    freeByGender.set(own, (freeByGender.get(own) ?? 0) + free);
  }
  if (freeByGender.size === 0) freeByGender.set(defaultGender(type.gender_policy, type.capacity_per_room), 0);
  const genders = ORDER.filter((g) => freeByGender.has(g));

  const now = new Date().toISOString();
  const rows = genders.map((gender, i) => {
    const free = freeByGender.get(gender) ?? 0;
    const forceFull = varied && genders.length > 1 && i === genders.length - 1;
    const status = forceFull || free === 0 ? "full" : "available_to_confirm";
    return {
      residence_id: type.residence_id,
      room_type_id: type.id,
      gender,
      status,
      available_count: status === "full" ? 0 : free,
      available_from: null,
      notes_public: null,
      last_confirmed_at: now,
    };
  });
  const { error } = await admin.from("profile_availability_genders").upsert(rows, { onConflict: "room_type_id,gender" });
  if (error) {
    console.error(`${type.name}: ERROR ${error.message}`);
    continue;
  }
  await admin.from("profile_availability_genders").delete().eq("room_type_id", type.id).not("gender", "in", `(${genders.join(",")})`);

  // Resumen del tipo (misma regla que `rollupTypeAvailability`).
  const available = rows.filter((r) => r.status === "available_to_confirm");
  const summary = available.length
    ? { status: "available_to_confirm", available_count: available.reduce((n, r) => n + r.available_count, 0) }
    : { status: "full", available_count: 0 };
  await admin
    .from("profile_availability")
    .update({ ...summary, available_from: null, last_confirmed_at: now, hidden_from_search_at: null })
    .eq("id", availability.id);
  console.log(`${type.name} (${type.residence_id.slice(0, 8)}): ${rows.map((r) => `${r.gender}=${r.status}/${r.available_count}`).join(", ")}`);
  done += 1;
}
console.log(`Listo: ${done} tipos con disponibilidad por género.`);
