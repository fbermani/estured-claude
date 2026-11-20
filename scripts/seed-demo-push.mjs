/**
 * Seed ADITIVO (DR61, notificaciones push): deja avisos de ejemplo con cada categoría y cada estado de push
 * (`queued`, `sent`, `skipped`, `none`) para Lucía (estudiante), Martín (familiar), Ricardo (dueño), admin y superadmin,
 * y una preferencia apagada («Registros nuevos») para el superadmin. Sirve para ver la campana con contador, las
 * categorías en Ajustes y probar el envío de lo encolado.
 *
 * Los dispositivos (`push_subscriptions`) NO se siembran: un endpoint solo existe cuando un navegador real se suscribe
 * (Ajustes → «Avisos en este dispositivo», o la tarjeta «Activar avisos»).
 *
 * Uso (DESPUÉS de seed-demo-users.mjs y con la migración 0101 aplicada):
 *   node --env-file=.env.local scripts/seed-demo-push.mjs
 *
 * Idempotente: no repite avisos con el mismo título para el mismo usuario. No borra ni recrea filas. Guard de producción incluido.
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const probe = await admin.from("notifications").select("category, push_status").limit(1);
if (probe.error) {
  console.error("✗ Falta la migración 0101 (db/migrations/0101_push_notifications.sql). Aplicala en el SQL Editor de dev y reintentá.");
  process.exit(1);
}

const emails = {
  lucia: "lucia.fernandez@example.com",
  martin: "padre.lucia@example.com",
  ricardo: "owner.residencia.norte@example.com",
  admin: "admin.operaciones@estured.test",
  superadmin: "superadmin@estured.test",
};
const ids = {};
for (const [key, email] of Object.entries(emails)) {
  const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
  if (!data) {
    console.error(`✗ No existe el usuario demo ${email}. Correr antes seed-demo-users.mjs.`);
    process.exit(1);
  }
  ids[key] = data.id;
}

const samples = [
  ["lucia", "requests_reservations", "sent", "Residencia Norte aceptó tu solicitud", "Ya hay contacto con la residencia. Falta confirmar las condiciones y el pago."],
  ["lucia", "payments_fee", "queued", "Fee EstuRed a pagar", "Tenés un plazo para abonar el fee de tu reserva."],
  ["lucia", "deadlines", "skipped", "Tu aviso de cambio vence en 10 días", "Confirmá si seguís buscando para mantenerlo."],
  ["lucia", "none", "none", "Enviamos tu pedido de cambio de habitación", "La residencia lo va a revisar."],
  ["martin", "payments_fee", "sent", "Te designaron para pagar el fee EstuRed", "Podés pagarlo desde la pantalla del fee."],
  ["ricardo", "requests_reservations", "sent", "Solicitud nueva", "Llegó una solicitud a Residencia Norte."],
  ["ricardo", "deadlines", "queued", "La verificación anual vence pronto", "Renovala para seguir publicada."],
  ["admin", "admin_requests", "sent", "Una residencia pidió revisión", "Revisá el perfil en Verificaciones."],
  ["admin", "admin_signups", "queued", "Se registró un estudiante", "Cuenta nueva."],
  ["superadmin", "admin_requests", "sent", "Cambiaron los datos de cobro del fee", "Revisalo en Pagos → Datos de cobro."],
  ["superadmin", "admin_signups", "queued", "Se registró una residencia", "Alta nueva para revisar."],
];

let created = 0;
for (const [who, category, pushStatus, title, body] of samples) {
  const userId = ids[who];
  const { data: existing } = await admin.from("notifications").select("id").eq("user_id", userId).eq("title", title).limit(1);
  if (existing?.length) continue;
  const { error } = await admin.from("notifications").insert({ user_id: userId, title, body, category, push_status: pushStatus });
  if (error) {
    console.error(`✗ ${who} / ${title}: ${error.message}`);
    continue;
  }
  created += 1;
}
console.log(`✓ Avisos de ejemplo creados: ${created} (los repetidos se omiten).`);

const pref = await admin
  .from("push_preferences")
  .upsert({ user_id: ids.superadmin, category: "admin_signups", enabled: false }, { onConflict: "user_id,category" });
console.log(pref.error ? `✗ Preferencia del superadmin: ${pref.error.message}` : "✓ Superadmin con «Registros nuevos» apagado (para ver el interruptor en Ajustes).");
