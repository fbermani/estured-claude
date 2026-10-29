// Corrige tipo y género de las habitaciones de Sin Fronteras según el listado del dueño (2026-10-28). SOLO estured-dev. Idempotente.
//   node --env-file=.env.local scripts/fix-sin-fronteras-habitaciones.mjs
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, ctx) => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data;
};
const RESIDENCE_ID = "54d972ea-25a2-4933-add3-8a683684d452";

// Hab → [tipo, género]. Las individuales son de género indistinto.
const PLAN = {
  1: ["Doble", "masculino"], 4: ["Cuádruple", "masculino"], 5: ["Triple", "masculino"], 9: ["Triple", "masculino"],
  6: ["Doble", "masculino"], 7: ["Doble", "masculino"], 10: ["Doble", "masculino"],
  8: ["Triple", "femenino"], 12: ["Doble", "femenino"],
  11: ["Individual", "sin_especificar"], 13: ["Individual", "sin_especificar"], 14: ["Individual", "sin_especificar"],
  15: ["Individual", "sin_especificar"], 16: ["Individual", "sin_especificar"],
};

const types = must(await admin.from("room_types").select("id, name, capacity_per_room").eq("residence_id", RESIDENCE_ID).eq("is_active", true), "tipos");
const byName = new Map(types.map((t) => [t.name, t]));
const rooms = must(await admin.from("rooms").select("id, label, room_type_id").eq("residence_id", RESIDENCE_ID), "habitaciones");

for (const room of rooms) {
  const n = Number(/^Hab (\d+)$/.exec(room.label)?.[1]);
  const plan = PLAN[n];
  if (!plan) continue;
  const type = byName.get(plan[0]);
  if (!type) throw new Error(`Falta el tipo ${plan[0]}`);
  must(await admin.from("rooms").update({ room_type_id: type.id, gender: plan[1] }).eq("id", room.id).eq("residence_id", RESIDENCE_ID), `actualizar ${room.label}`);
  // Camas acordes a la capacidad del tipo.
  const beds = must(await admin.from("beds").select("id, letter").eq("room_id", room.id).order("letter"), `camas ${room.label}`);
  for (let i = beds.length; i < type.capacity_per_room; i++) {
    must(await admin.from("beds").insert({ room_id: room.id, letter: "ABCDEFGHIJ"[i], sort_order: i }), `agregar cama ${room.label}`);
  }
  for (const bed of beds.slice(type.capacity_per_room)) {
    must(await admin.from("beds").delete().eq("id", bed.id), `quitar cama ${room.label}`);
  }
  console.log(`✓ ${room.label}: ${plan[0]} · ${plan[1]}`);
}

const fresh = must(await admin.from("rooms").select("room_type_id, is_active").eq("residence_id", RESIDENCE_ID), "recuento");
const cap = new Map(types.map((t) => [t.id, t.capacity_per_room]));
console.log(`Capacidad calculada: ${fresh.filter((r) => r.is_active).reduce((n, r) => n + (cap.get(r.room_type_id) ?? 0), 0)} plazas (objetivo 28)`);
