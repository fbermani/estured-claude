/**
 * Seed ADITIVO de los datos de cobro del fee (D2 / H02, migración 0038).
 * Carga una fila claramente ficticia para poder ver la pantalla de pago del
 * fee y el panel /admin/payment-settings en desarrollo. NO borra nada:
 * solo crea la fila si no hay ninguna (no pisa datos que el admin ya cargó).
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-demo-payment-settings.mjs
 *
 * Los datos son de prueba: CBU de 22 ceros (la entidad 000 no existe),
 * alias y titular marcados como demo. Nunca cargar datos reales desde acá.
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

const { data: existing, error: readError } = await admin.from("payment_settings").select("id").maybeSingle();
if (readError) {
  console.error("No pude leer payment_settings (¿está aplicada la migración 0038?):", readError.message);
  process.exit(1);
}
if (existing) {
  console.log("Ya hay datos de cobro cargados — no se toca nada.");
  process.exit(0);
}

const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").maybeSingle();

const { error } = await admin.from("payment_settings").insert({
  account_holder: "EstuRed (datos de prueba)",
  alias: "estured.demo.cobro",
  cbu: "0000000000000000000000",
  bank_name: "Banco de Prueba",
  instructions: "Datos de PRUEBA: no transfieras dinero real a esta cuenta.",
  updated_by_user_id: adminUser?.id ?? null,
});
if (error) {
  console.error("No pude cargar los datos de cobro demo:", error.message);
  process.exit(1);
}
console.log("✓ Datos de cobro demo cargados (alias estured.demo.cobro).");
