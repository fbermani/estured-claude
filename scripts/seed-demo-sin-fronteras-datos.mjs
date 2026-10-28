// Datos demo de Residencia Sin Fronteras (DR18 fase 2, tanda 4). SOLO estured-dev. Idempotente y NO borra filas.
//   node --env-file=.env.local scripts/seed-demo-sin-fronteras-datos.mjs
// Hace: (a) género por habitación (rooms.gender, 0057), (b) completa la capacidad a 28 plazas agregando Hab 1 (Doble) si falta.
// La FAQ-29/FAQ-50 se unifica con la migración 0063 (no con este script).
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, ctx) => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data;
};

const RESIDENCE_ID = "54d972ea-25a2-4933-add3-8a683684d452";
const EXPECTED_SLUG = "residencia-sin-fronteras-29fefe";
const TARGET_CAPACITY = 28;

// Hab 14 es individual y queda sin género (indistinto). Las demás, según la confirmación del dueño.
const GENDERS = {
  1: "masculino", 4: "masculino", 5: "masculino", 6: "masculino", 7: "masculino", 9: "masculino",
  10: "masculino", 11: "masculino", 13: "masculino", 15: "masculino", 16: "masculino",
  8: "femenino", 12: "femenino",
  14: "sin_especificar",
};

const residence = must(await admin.from("residences").select("id, slug").eq("id", RESIDENCE_ID).maybeSingle(), "residencia");
if (!residence || residence.slug !== EXPECTED_SLUG) throw new Error("No encontré la residencia Sin Fronteras esperada en este proyecto.");

const types = must(await admin.from("room_types").select("id, name, capacity_per_room").eq("residence_id", RESIDENCE_ID).eq("is_active", true), "tipos");
const doble = types.find((t) => t.name === "Doble");
if (!doble) throw new Error("La residencia no tiene el tipo «Doble».");

// ---- (b) Hab 1 (Doble) si falta
let rooms = must(await admin.from("rooms").select("id, label, room_type_id, is_active").eq("residence_id", RESIDENCE_ID), "habitaciones");
if (!rooms.some((r) => r.label === "Hab 1")) {
  const room = must(
    await admin.from("rooms").insert({ residence_id: RESIDENCE_ID, room_type_id: doble.id, label: "Hab 1", sort_order: 0 }).select("id").single(),
    "crear Hab 1",
  );
  must(
    await admin.from("beds").insert(Array.from({ length: doble.capacity_per_room }, (_, i) => ({ room_id: room.id, letter: "ABCDEFGHIJ"[i], sort_order: i }))),
    "camas Hab 1",
  );
  console.log("✓ Hab 1 (Doble) creada con sus camas");
  rooms = must(await admin.from("rooms").select("id, label, room_type_id, is_active").eq("residence_id", RESIDENCE_ID), "habitaciones");
}

// ---- (a) género por habitación
for (const r of rooms) {
  const n = Number(/^Hab (\d+)$/.exec(r.label)?.[1]);
  const gender = GENDERS[n];
  if (!gender) continue;
  must(await admin.from("rooms").update({ gender }).eq("id", r.id).eq("residence_id", RESIDENCE_ID), `género ${r.label}`);
}
console.log("✓ género por habitación aplicado");

// ---- capacidad (misma cuenta que lib/residences/occupancy.computeCapacity)
const capByType = new Map(types.map((t) => [t.id, Math.max(1, Math.floor(Number(t.capacity_per_room) || 1))]));
const capacity = rooms.filter((r) => r.is_active).reduce((n, r) => n + (capByType.get(r.room_type_id) ?? 0), 0);
console.log(`Capacidad calculada: ${capacity} plazas (objetivo ${TARGET_CAPACITY})${capacity === TARGET_CAPACITY ? " ✓" : " ✗ revisar habitaciones"}`);
