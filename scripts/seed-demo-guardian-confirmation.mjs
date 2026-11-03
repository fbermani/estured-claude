/**
 * Seed de la confirmación del tutor (DR32, migración 0071): deja UN pedido pendiente de Valentina (menor, 17) para la estadía en Residencia Norte,
 * para ver la tarjeta «¿Confirmás la estadía de Valentina?» en el inicio de su familiar vinculado y el aviso «Esperando la confirmación de tu familiar»
 * en `/students/residency` de Valentina. No toca filas existentes: solo reemplaza el pedido pendiente que sembró este mismo script.
 * Al confirmar desde la tarjeta se crea la estadía activa en Norte (así probás el camino completo).
 *
 * REQUIERE la migración 0071 aplicada en estured-dev. Uso: node --env-file=.env.local scripts/seed-demo-guardian-confirmation.mjs
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

const probe = await admin.from("guardian_stay_confirmations").select("id", { head: true, count: "exact" });
if (probe.error) {
  console.error(`✗ La tabla guardian_stay_confirmations no existe todavía (${probe.error.code}). Aplicá antes db/migrations/0071_guardian_stay_confirmations.sql en el SQL Editor de estured-dev.`);
  process.exit(1);
}

const { data: user } = await admin.from("users").select("id").eq("email", "valentina.sosa@example.com").maybeSingle();
const { data: profile } = user ? await admin.from("student_profiles").select("id, is_minor").eq("user_id", user.id).maybeSingle() : { data: null };
const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").maybeSingle();
const { data: ru } = owner ? await admin.from("residence_users").select("residence_id").eq("user_id", owner.id).eq("role", "owner").eq("is_active", true).order("created_at").limit(1).maybeSingle() : { data: null };
if (!profile?.is_minor || !ru) {
  console.error("✗ No encontré a Valentina (menor) o a Residencia Norte. Corré antes los seeds de usuarios y datos demo.");
  process.exit(1);
}
const { data: link } = await admin.from("family_links").select("id").eq("student_profile_id", profile.id).eq("status", "active").maybeSingle();
if (!link) {
  console.error("✗ Valentina no tiene un familiar con vínculo activo: sin él no hay a quién pedirle la confirmación.");
  process.exit(1);
}
const { data: current } = await admin.from("resident_stays").select("id").eq("student_profile_id", profile.id).eq("is_current", true).limit(1);
if (current?.length) {
  console.error("✗ Valentina ya tiene una estadía vigente; el pedido no tendría sentido. Nada se tocó.");
  process.exit(1);
}

await admin.from("guardian_stay_confirmations").delete().eq("student_profile_id", profile.id).eq("status", "pending");
const now = Date.now();
const { error } = await admin.from("guardian_stay_confirmations").insert({
  student_profile_id: profile.id,
  residence_id: ru.residence_id,
  origin: "residence_approval",
  status: "pending",
  requested_at: new Date(now).toISOString(),
  expires_at: new Date(now + 7 * 86_400_000).toISOString(),
});
if (error) {
  console.error("✗ No pude crear el pedido:", error.message);
  process.exit(1);
}
console.log("✓ Pedido pendiente de Valentina creado (vence en 7 días).");
