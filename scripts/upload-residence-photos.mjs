/**
 * Sube las fotos de `design-references/Fotos Residencias/` a Storage y las
 * vincula como `residence_photo` para las 3 residencias reales (Ciclo
 * 34undevicies). Reparte los archivos round-robin entre residencias.
 *
 * Uso: node --env-file=.env.local scripts/upload-residence-photos.mjs
 * Idempotente: si una residencia ya tiene fotos vinculadas, no vuelve a
 * subir (evita duplicar en corridas repetidas).
 */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const PHOTOS_DIR = join(process.cwd(), "design-references", "Fotos Residencias");
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_BY_EXT = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".png": "image/png" };

const RESIDENCES = [
  { id: "b2a25202-b08e-4dd1-bfcb-6eb1a7267583", label: "Residencia Río de la Plata" },
  { id: "06addddb-349c-41ba-9a4c-3e40c7189042", label: "Residencia Norte" },
  { id: "063d9032-0684-44d2-90dd-6a73faa352d4", label: "Casa Compartida Almagro" },
];
const OWNER_USER_ID = "a250db0d-2357-4328-8c7b-f106e4f576de";

function extOf(filename) {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}
function sanitize(filename) {
  return filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-]/g, "-");
}

async function main() {
  const allFiles = readdirSync(PHOTOS_DIR).filter((f) => MIME_BY_EXT[extOf(f)]);
  console.log(`${allFiles.length} fotos encontradas en la carpeta.`);

  const byResidence = RESIDENCES.map(() => []);
  allFiles.forEach((f, i) => byResidence[i % RESIDENCES.length].push(f));

  for (let i = 0; i < RESIDENCES.length; i++) {
    const residence = RESIDENCES[i];
    console.log(`\n== ${residence.label} ==`);

    const { count: existingCount } = await admin
      .from("files")
      .select("*", { count: "exact", head: true })
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id)
      .eq("document_type", "residence_photo");
    if ((existingCount ?? 0) > 0) {
      console.log(`  ya tiene ${existingCount} fotos vinculadas, se omite.`);
      continue;
    }

    let uploaded = 0;
    for (const filename of byResidence[i]) {
      const fullPath = join(PHOTOS_DIR, filename);
      const stat = statSync(fullPath);
      if (stat.size > MAX_BYTES) {
        console.log(`  x ${filename} pesa ${(stat.size / 1024 / 1024).toFixed(1)}MB (> 5MB), se omite.`);
        continue;
      }
      const mimeType = MIME_BY_EXT[extOf(filename)];
      const storagePath = `${residence.id}/${Date.now()}-${sanitize(filename)}`;
      const buffer = readFileSync(fullPath);

      const { error: uploadError } = await admin.storage
        .from("public-residence-media")
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
      if (uploadError) {
        console.log(`  x ${filename} error de storage: ${uploadError.message}`);
        continue;
      }

      const { error: insertError } = await admin.from("files").insert({
        owner_user_id: OWNER_USER_ID,
        related_entity_type: "residences",
        related_entity_id: residence.id,
        bucket: "public-residence-media",
        storage_path: storagePath,
        filename,
        mime_type: mimeType,
        size_bytes: stat.size,
        visibility: "public",
        document_type: "residence_photo",
        status: "approved",
        uploaded_by_user_id: OWNER_USER_ID,
      });
      if (insertError) {
        console.log(`  x ${filename} error en files: ${insertError.message}`);
        continue;
      }
      uploaded += 1;
      console.log(`  + ${filename}`);
    }
    console.log(`  ${uploaded}/${byResidence[i].length} fotos subidas y vinculadas.`);
  }

  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
