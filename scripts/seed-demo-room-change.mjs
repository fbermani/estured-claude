/**
 * Demo del cambio de habitación (DR34, migración 0076). ADITIVO e idempotente: no borra estadías ni reservas; solo (re)crea los pedidos y el
 * aviso de plaza de este script (los pedidos demo llevan «(demo)» al principio del motivo). Necesita la migración 0076 aplicada en estured-dev.
 *
 * En Residencia Norte (demo), con los residentes que ya tienen cuenta y estadía activa:
 *   - 1.er residente: pedido PENDIENTE del estudiante (tipo de su misma residencia, género mixto, nota «un piso más alto»).
 *   - 2.º residente: pedido EN GESTIÓN anotado por la residencia (sin plaza ofrecida).
 *   - 3.er residente (si hay): pedido PENDIENTE sin preferencia de tipo ni género («me da igual»).
 *   - Si hay una cama libre y activa en Norte: un aviso de plaza liberada por decidir (cambio de cama) que coincide con los pedidos pendientes.
 * Login demo: Ricardo (dueño de Norte) ve el aviso y el filtro «Piden otra habitación» en Residentes; el 1.er residente ve «Cambio de habitación» en Mi residencia.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-room-change.mjs
 * ⚠ Si se re-corre scripts/seed-demo-data.mjs (recrea filas con UUID nuevo) hay que re-correr este seed.
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

const probe = await admin.from("room_change_requests").select("id", { head: true, count: "exact" });
if (probe.error) {
  console.error(`✗ Falta la migración 0076 en este proyecto (${probe.error.message}). Aplicala primero en el SQL Editor de estured-dev.`);
  process.exit(1);
}

const { data: norte } = await admin.from("residences").select("id, name").eq("slug", "residencia-norte-demo").maybeSingle();
if (!norte) {
  console.error("✗ Falta la residencia demo (correr scripts/seed-demo-data.mjs primero).");
  process.exit(1);
}

const [{ data: stays }, { data: types }] = await Promise.all([
  admin
    .from("resident_stays")
    .select("id, student_profile_id, room_type_id, bed_id, status")
    .eq("residence_id", norte.id)
    .eq("is_current", true)
    .not("student_profile_id", "is", null)
    .in("status", ["active", "visibility_limited", "hidden_by_user"])
    .order("created_at", { ascending: true })
    .limit(3),
  admin.from("room_types").select("id, name").eq("residence_id", norte.id).eq("is_active", true).order("name", { ascending: true }),
]);
if (!stays?.length) {
  console.error("✗ Norte no tiene residentes con cuenta y estadía activa (correr scripts/seed-demo-data.mjs y seed-residence-community.mjs).");
  process.exit(1);
}

// Limpia solo lo que sembró este script.
const stayIds = stays.map((s) => s.id);
await admin.from("room_change_place_alerts").delete().eq("residence_id", norte.id).eq("place_label", "Hab. demo · Cama libre (demo)");
await admin.from("room_change_requests").delete().in("resident_stay_id", stayIds).like("reason", "(demo)%");

const anyType = types?.[0]?.id ?? null;
const plans = [
  { origin: "student", status: "pending", preferred_room_type_id: stays[0].room_type_id ?? anyType, preferred_gender: "mixto", preference_note: "Un piso más alto", reason: "(demo) Es una zona ruidosa y necesito estudiar de noche." },
  { origin: "residence", status: "offered", preferred_room_type_id: anyType, preferred_gender: null, preference_note: null, reason: "(demo) Pidió cambio por convivencia." },
  { origin: "student", status: "pending", preferred_room_type_id: null, preferred_gender: null, preference_note: "Cerca de la cocina", reason: "(demo) Me da igual el tipo." },
];
const created = [];
for (let i = 0; i < stays.length; i++) {
  const stay = stays[i];
  const plan = plans[i];
  const { data: open } = await admin.from("room_change_requests").select("id").eq("resident_stay_id", stay.id).in("status", ["pending", "offered"]).maybeSingle();
  if (open) {
    console.log(`• ${stay.id}: ya tiene un pedido abierto, se saltea`);
    continue;
  }
  const row = {
    residence_id: norte.id,
    resident_stay_id: stay.id,
    student_profile_id: stay.student_profile_id,
    ...plan,
    costs_notice_text: plan.origin === "student" ? "Entiendo que el cambio está sujeto a la disponibilidad de la residencia y que, si se concreta, asumo los costos que correspondan, que me informa y acuerda la residencia. EstuRed no cobra nada por este pedido." : null,
    costs_acknowledged_at: plan.origin === "student" ? new Date().toISOString() : null,
  };
  const { data, error } = await admin.from("room_change_requests").insert(row).select("id, status").single();
  if (error) console.error("✗ pedido:", error.message);
  else {
    created.push(data);
    console.log(`✓ pedido ${data.status} para la estadía ${stay.id}`);
  }
}

// Aviso de plaza liberada: una cama activa y libre de Norte.
const { data: rooms } = await admin.from("rooms").select("id, room_type_id, gender").eq("residence_id", norte.id).eq("is_active", true);
const roomIds = (rooms ?? []).map((r) => r.id);
const { data: beds } = roomIds.length ? await admin.from("beds").select("id, room_id, status").in("room_id", roomIds).eq("status", "active") : { data: [] };
const { data: occupied } = await admin.from("resident_stays").select("bed_id").eq("residence_id", norte.id).eq("is_current", true).not("bed_id", "is", null);
const occupiedSet = new Set((occupied ?? []).map((o) => o.bed_id));
const free = (beds ?? []).find((b) => !occupiedSet.has(b.id));
if (free && created.some((c) => c.status === "pending")) {
  const room = rooms.find((r) => r.id === free.room_id);
  const { error } = await admin.from("room_change_place_alerts").insert({
    residence_id: norte.id,
    bed_id: free.id,
    room_type_id: room?.room_type_id ?? null,
    place_label: "Hab. demo · Cama libre (demo)",
    gender: room?.gender && room.gender !== "sin_especificar" ? room.gender : "mixto",
    source: "bed_move",
    status: "pending",
    deferred_increment: false,
  });
  console.log(error ? `✗ aviso: ${error.message}` : "✓ aviso de plaza liberada por decidir");
} else {
  console.log("• Sin cama libre en Norte (o sin pedidos pendientes): no se siembra el aviso de plaza");
}
console.log("\nSeed del cambio de habitación listo. Ricardo (dueño de Norte): Residentes → «Piden otra habitación». Un residente: Mi residencia → «Cambio de habitación».");
