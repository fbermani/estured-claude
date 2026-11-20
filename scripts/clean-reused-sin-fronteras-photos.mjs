/**
 * Limpia las fotos «prestadas»: seed-demo-search-residences.mjs reutilizó los archivos de Storage de
 * «Residencia Sin Fronteras» como placeholder en otras residencias demo. Este script borra, de las demás
 * residencias, SOLO las filas de `files` (document_type = residence_photo) cuyo `storage_path` coincide con
 * una foto de Sin Fronteras. `residence_photo_meta` cae por cascade. Los archivos de Storage NO se tocan
 * (siguen siendo los de Sin Fronteras). Las fotos propias de otras residencias se conservan.
 * Las residencias que quedan sin fotos muestran el placeholder de marca con el barrio (ResidencePhoto).
 *
 * Uso (solo estured-dev; simula por defecto):
 *   node --env-file=.env.local scripts/clean-reused-sin-fronteras-photos.mjs           # simula
 *   node --env-file=.env.local scripts/clean-reused-sin-fronteras-photos.mjs --apply   # borra
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const SIN_FRONTERAS_ID = "54d972ea-25a2-4933-add3-8a683684d452";
const apply = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const must = (r, ctx) => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data;
};

const sf = must(
  await admin.from("files").select("storage_path").eq("related_entity_id", SIN_FRONTERAS_ID).eq("document_type", "residence_photo"),
  "fotos de Sin Fronteras",
);
const sfPaths = new Set(sf.map((f) => f.storage_path));
if (sfPaths.size === 0) {
  console.error("Sin Fronteras no tiene fotos: nada que comparar, abortando.");
  process.exit(1);
}

const others = must(
  await admin.from("files").select("id, related_entity_id, storage_path").eq("document_type", "residence_photo").neq("related_entity_id", SIN_FRONTERAS_ID),
  "fotos de otras residencias",
);
const reused = others.filter((f) => sfPaths.has(f.storage_path));
const own = others.filter((f) => !sfPaths.has(f.storage_path));

const residences = must(await admin.from("residences").select("id, name"), "residencias");
const nameOf = Object.fromEntries(residences.map((r) => [r.id, r.name]));
const count = (rows) => rows.reduce((acc, f) => ({ ...acc, [nameOf[f.related_entity_id] ?? f.related_entity_id]: (acc[nameOf[f.related_entity_id] ?? f.related_entity_id] ?? 0) + 1 }), {});

console.log(`Fotos de Sin Fronteras: ${sfPaths.size}`);
console.log(`Otras residencias — fotos que reutilizan las de Sin Fronteras (se borran): ${reused.length}`);
console.table(count(reused));
console.log(`Otras residencias — fotos propias (se conservan): ${own.length}`);
if (own.length) console.table(count(own));

if (!apply) {
  console.log("\nSimulación: no se borró nada. Agregá --apply para borrar.");
  process.exit(0);
}

const ids = reused.map((f) => f.id);
for (let i = 0; i < ids.length; i += 100) {
  must(await admin.from("files").delete().in("id", ids.slice(i, i + 100)), "borrar filas de files");
}
console.log(`\n✓ Borradas ${ids.length} filas de files (y su residence_photo_meta por cascade).`);
