/**
 * Seed aditivo del reglamento (DR14, migración 0053) para la Residencia Norte demo: versión 1 (reemplazada) y versión 2 (vigente),
 * y la aceptación de la v1 en una solicitud existente (muestra que los cambios no afectan lo ya aceptado). Las demás residencias quedan
 * SIN reglamento propio: su ficha muestra el modelo de EstuRed. Idempotente: si Norte ya tiene versiones, no hace nada.
 *
 * Requiere la migración 0053 aplicada en estured-dev. Uso: node --env-file=.env.local scripts/seed-demo-regulation.mjs
 */
import "./_assert-dev-project.mjs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");

const V1 = `CONVIVENCIA Y HORARIOS

Art. 1. Objeto y aceptación
Este reglamento ordena la convivencia en Residencia Norte. Quien reside lo recibe al ingresar y declara haberlo leído. Las modificaciones se comunican por correo con 15 días de anticipación.

Art. 2. Horarios de silencio
Se guarda silencio desde las 23:00 hasta las 7:00 y entre las 14:00 y las 16:00. Música y videos, con auriculares en habitaciones y espacios comunes.

Art. 3. Visitas
Las visitas se reciben de 10:00 a 21:00 y se anuncian en recepción. Permanecen en los espacios comunes. No hay pernocte de visitas.

PAGOS

Art. 4. Mensualidad
La mensualidad se paga del día 1 al 10 de cada mes, por transferencia. Si el pago no llega en fecha, se avisa a administración y se acuerda cómo regularizarlo.

Art. 5. Egreso
Se avisa con 30 días de anticipación. La habitación se entrega limpia, con las llaves y accesos, y se hace un recorrido con el responsable.`;

const V2 = V1.replace("No hay pernocte de visitas.", "El pernocte de visitas se permite hasta 2 noches con autorización previa del responsable.");

const { data: residence } = await admin.from("residences").select("id").eq("slug", "residencia-norte-demo").maybeSingle();
if (!residence) {
  console.error("No existe residencia-norte-demo. Correr antes scripts/seed-demo-data.mjs");
  process.exit(1);
}
const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").maybeSingle();

const { data: existing, error: readError } = await admin
  .from("residence_regulation_versions")
  .select("id")
  .eq("residence_id", residence.id)
  .limit(1);
if (readError) {
  console.error("✗ No se pudo leer residence_regulation_versions (¿falta aplicar db/migrations/0053_residence_regulations.sql?):", readError.message);
  process.exit(1);
}
if (existing?.length) {
  console.log("· Norte ya tiene reglamento: nada para hacer");
  process.exit(0);
}

const now = new Date();
const earlier = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString();
const rows = [
  { version_number: 1, content: V1, status: "superseded", published_at: earlier },
  { version_number: 2, content: V2, status: "published", published_at: now.toISOString() },
];
const ids = {};
for (const r of rows) {
  const { data, error } = await admin
    .from("residence_regulation_versions")
    .insert({
      residence_id: residence.id,
      version_number: r.version_number,
      source: "own",
      content: { text: r.content },
      content_hash: sha(r.content),
      status: r.status === "published" ? "draft" : "published", // se respeta el orden de transiciones del trigger
      published_at: r.published_at,
      created_by_user_id: owner?.id ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }
  ids[r.version_number] = data.id;
  if (r.status === "superseded") {
    const { error: e2 } = await admin.from("residence_regulation_versions").update({ status: "superseded" }).eq("id", data.id);
    if (e2) {
      console.error("✗", e2.message);
      process.exit(1);
    }
  }
}
const { error: pubError } = await admin.from("residence_regulation_versions").update({ status: "published" }).eq("id", ids[2]);
if (pubError) {
  console.error("✗", pubError.message);
  process.exit(1);
}
await admin.from("residences").update({ current_regulation_version_id: ids[2] }).eq("id", residence.id);
console.log("✓ Norte: v1 (reemplazada) y v2 (vigente)");

// La v1 aceptada en una solicitud existente de Norte (prueba de que los cambios posteriores no la afectan).
const { data: app } = await admin
  .from("application_requests")
  .select("id, created_by_user_id")
  .eq("residence_id", residence.id)
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();
if (app) {
  const { error } = await admin.from("application_regulation_acceptances").insert({
    application_request_id: app.id,
    residence_id: residence.id,
    regulation_version_id: ids[1],
    content_hash: sha(V1),
    accepted_by_user_id: app.created_by_user_id,
    accepted_by_role: "student",
  });
  console.log(error ? `· aceptación demo no creada: ${error.message}` : "✓ aceptación de la v1 en una solicitud existente");
}
