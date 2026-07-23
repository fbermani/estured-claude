/**
 * Sube las fotos de `design-references/Fotos Residencias/` a Storage y las
 * vincula como `residence_photo` para las 3 residencias reales (Ciclo
 * 34undevicies). Reparte los archivos round-robin entre residencias.
 *
 * Uso: node --env-file=.env.local scripts/upload-residence-photos.mjs
 * Idempotente: si una residencia ya tiene fotos vinculadas, no vuelve a
 * subir (evita duplicar en corridas repetidas).
 *
 * Las residencias se resuelven por `slug` en cada corrida (antes eran
 * UUIDs hardcodeados — un `seed-demo-data.mjs` reseedea borrando y
 * recreando las residencias con UUIDs nuevos, así que un ID fijo queda
 * apuntando a una fila que ya no existe y las fotos "desaparecen" de la
 * ficha sin que el script tire ningún error. Ciclo 35sexdecies).
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

const RESIDENCE_SLUGS = [
  "residencia-rio-de-la-plata-demo",
  "residencia-norte-demo",
  "casa-almagro-demo",
];

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
  const { data: rows, error: lookupError } = await admin
    .from("residences")
    .select("id, name, slug, created_by")
    .in("slug", RESIDENCE_SLUGS);
  if (lookupError) throw lookupError;

  const RESIDENCES = RESIDENCE_SLUGS.map((slug) => {
    const row = (rows ?? []).find((r) => r.slug === slug);
    if (!row) {
      console.log(`  x no se encontró ninguna residencia con slug "${slug}", se omite.`);
      return null;
    }
    return { id: row.id, label: row.name, ownerUserId: row.created_by };
  }).filter((r) => r !== null);

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
        owner_user_id: residence.ownerUserId,
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
        uploaded_by_user_id: residence.ownerUserId,
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
