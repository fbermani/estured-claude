/**
 * Demo del reenvío tras "pedir cambios" (Ciclo 66, DR5). Deja "Casa Compartida Almagro" en `needs_changes` con un mensaje
 * del admin, para ver el banner del Panel y el aviso en /profile con el owner demo (Ricardo). Aditivo: no borra nada.
 *
 *   node --env-file=.env.local scripts/seed-needs-changes-demo.mjs          # pone needs_changes + mensaje
 *   node --env-file=.env.local scripts/seed-needs-changes-demo.mjs --revert # vuelve a pending_verification
 *
 * El mensaje requiere la migración 0048 aplicada; sin ella solo cambia el estado (se ve el copy genérico).
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const revert = process.argv.includes("--revert");
const { data: residence } = await admin.from("residences").select("id").eq("slug", "casa-almagro-demo").single();
if (!residence) throw new Error("No existe casa-almagro-demo: corré antes seed-demo-data.mjs");

await admin.from("residences").update({ status: revert ? "pending_verification" : "needs_changes" }).eq("id", residence.id);
await admin
  .from("residence_verifications")
  .update({ status: revert ? "documents_pending" : "needs_changes" })
  .eq("residence_id", residence.id);

const { error } = await admin
  .from("residence_verifications")
  .update(
    revert
      ? { changes_requested_message: null, changes_requested_at: null }
      : {
          changes_requested_message:
            "Faltan fotos propias: subí al menos 3 (fachada, un cuarto y un espacio común). También completá el resumen de normas de convivencia.",
          changes_requested_at: new Date().toISOString(),
        },
  )
  .eq("residence_id", residence.id);
if (error) console.warn("⚠ No se pudo escribir el mensaje (¿falta aplicar la 0048?):", error.message);
console.log(revert ? "✓ Almagro vuelve a pending_verification" : "✓ Almagro en needs_changes", residence.id);
