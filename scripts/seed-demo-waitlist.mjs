/**
 * Seed de la lista de espera de «Residencia Río de la Plata» (solo dev): 12 pedidos ficticios repartidos entre los 4 tipos de habitación
 * y «cualquier tipo», con estados (en espera / avisado / chequeo de retención), meses de ingreso (DR40: día 1 del mes; este mes = urgente), varios «Cuando haya lugar» (sin mes) y antigüedades distintas.
 * Para ver `/residence/<id>/waitlist` con contenido. Idempotente: borra solo las filas de los estudiantes demo listados acá y las recrea.
 * Quitar: node --env-file=.env.local scripts/seed-demo-waitlist.mjs --delete
 * Uso:   node --env-file=.env.local scripts/seed-demo-waitlist.mjs
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

const day = 24 * 3600 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * day);
// DR40: el ingreso es un MES; se guarda el día 1 (mes en curso en hora de Buenos Aires + n meses).
const baNow = new Date(Date.now() - 3 * 3600 * 1000);
const monthStart = (n) => {
  const d = new Date(Date.UTC(baNow.getUTCFullYear(), baNow.getUTCMonth() + n, 1));
  return d.toISOString().slice(0, 10);
};

const { data: residence } = await admin.from("residences").select("id").eq("name", "Residencia Río de la Plata").maybeSingle();
if (!residence) {
  console.error("✗ No encontré «Residencia Río de la Plata». Corré antes los seeds de datos demo.");
  process.exit(1);
}
const { data: types } = await admin.from("room_types").select("id, name").eq("residence_id", residence.id);
const typeId = (name) => types?.find((t) => t.name === name)?.id ?? null;

// [estudiante (id), tipo de habitación o null = cualquiera, estado, días de espera, mes de ingreso (0 = este mes, null = «Cuando haya lugar»), meses]
const ROWS = [
  ["635b2d06-3ef1-4974-a1a8-6a18c7fd01c5", "Individual", "availability_notification_sent", 21, 0, 6], // Mateo F. — avisado, urgente
  ["3ab50c6e-58eb-4850-95d5-21069b65db94", "Individual", "active", 34, 2, 10], // Ana J.
  ["5a1970fc-7be3-430d-a2b3-7fed625131ad", "Individual", "active", 9, 0, 4], // Lucía L. — este mes
  ["4ea5b2fe-2c90-476b-add2-ce2f3cb40a79", "Individual", "active", 3, 5, 12], // Sofía I. — mes lejano
  ["e3c8a853-06a2-4000-be2f-e964346c9ed1", "Doble", "retention_check_sent", 40, 1, 6], // Nicolás G. — chequeo de retención
  ["78491f54-a2f3-4621-952e-4e8f2bb15337", "Doble", "active", 15, 3, 9], // Lautaro E.
  ["f2b9c869-81c0-4323-a7f4-f09430fdf359", "Doble", "active", 6, 0, 5], // Diego P. — este mes
  ["b4e91589-9bdd-450a-9c2f-8e947e3ee363", "Triple", "active", 27, null, 10], // Valentina M. — sin mes
  ["177177dc-2717-4378-84b5-45bd4acaa7d3", "Triple", "availability_notification_sent", 12, 1, 6], // Tomás Q.
  ["00c9180c-3b11-4c18-b31f-404617e56218", "Cuádruple", "active", 18, null, 12], // Ignacio S. — sin mes
  ["d10ff9fc-2d08-4042-8ea6-81cbf7b59634", null, "active", 5, 1, 6], // Juan S. — cualquier tipo
  ["c36e3826-a3ae-4eb0-9e13-e8102ccce319", null, "active", 30, null, null], // Liam T. — cualquier tipo, sin mes
];
const studentIds = ROWS.map((r) => r[0]);

const del = await admin.from("waitlist_entries").delete().eq("residence_id", residence.id).in("student_profile_id", studentIds);
if (del.error) {
  console.error("✗ No pude limpiar:", del.error.message);
  process.exit(1);
}
if (process.argv.includes("--delete")) {
  console.log("✓ Lista de espera demo de Río de la Plata borrada.");
  process.exit(0);
}

const payload = ROWS.map(([student, type, status, waited, monthOffset, months]) => ({
  student_profile_id: student,
  residence_id: residence.id,
  room_type_id: type ? typeId(type) : null,
  status,
  joined_at: daysFromNow(-waited).toISOString(),
  desired_start_date: monthOffset == null ? null : monthStart(monthOffset),
  desired_duration_months: months,
}));
const ins = await admin.from("waitlist_entries").insert(payload);
if (ins.error) {
  console.error("✗ No pude insertar:", ins.error.message);
  process.exit(1);
}
console.log(`✓ ${payload.length} pedidos en la lista de espera de Río de la Plata (${residence.id}).`);
