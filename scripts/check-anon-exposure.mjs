/**
 * Guard de regresión de privacidad (Ciclo 56): consulta la API REST de Supabase con la ANON KEY (la pública) y
 * FALLA (exit 1) si alguna columna sensible vuelve a ser legible o si una tabla privada devuelve filas.
 *
 * - Columnas: `GET /rest/v1/<tabla>?select=<columna>&limit=1`. Si responde 200 la columna existe y anon tiene
 *   privilegio de lectura, haya o no filas -> EXPUESTA. Un 400 (42703, la columna no existe) o 401/403 (42501) es
 *   lo esperado.
 * - Tablas privadas: `select=*` debe devolver `[]` (RLS sin policies) o un error; nunca filas.
 * - Positivo: el catálogo público (`residences`: id, name, slug, public_area) sigue siendo legible.
 *
 * Solo LEE. Aun así, por política del proyecto, se niega a correr contra PRODUCCIÓN salvo `--allow-production`
 * (útil para verificar el deploy después de aplicar 0043 y 0043b).
 * Lista de columnas: scripts/sensitive-columns.json.
 * Uso: node --env-file=.env.local scripts/check-anon-exposure.mjs [--allow-production]
 */
import { readFileSync } from "node:fs";

const { refs } = JSON.parse(readFileSync(new URL("./production-refs.json", import.meta.url), "utf-8"));
const { columns, privateTables } = JSON.parse(readFileSync(new URL("./sensitive-columns.json", import.meta.url), "utf-8"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Correr con --env-file=.env.local");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
if (refs.includes(ref) && !process.argv.includes("--allow-production")) {
  console.error(`✗ Apunta a PRODUCCIÓN (${ref}). Es solo lectura, pero hay que pedirlo explícito: --allow-production`);
  process.exit(1);
}

const headers = { apikey: anon, Authorization: `Bearer ${anon}` };
const get = async (path) => {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
};

const failures = [];

for (const [table, cols] of Object.entries(columns)) {
  for (const col of cols) {
    const { status } = await get(`${table}?select=${col}&limit=1`);
    if (status === 200) failures.push(`EXPUESTA: ${table}.${col} es legible con la anon key (HTTP 200)`);
    else console.log(`✓ ${table}.${col} no legible (HTTP ${status})`);
  }
}

for (const table of privateTables) {
  const { status, body } = await get(`${table}?select=*&limit=1`);
  if (status === 200 && Array.isArray(body) && body.length > 0) failures.push(`EXPUESTA: ${table} devuelve filas con la anon key`);
  else console.log(`✓ ${table} sin filas para anon (HTTP ${status})`);
}

const pub = await get("residences?select=id,name,slug,public_area&limit=1");
if (pub.status !== 200) failures.push(`El catálogo público dejó de ser legible (HTTP ${pub.status}): residences?select=id,name,slug,public_area`);
else console.log("✓ el catálogo público sigue legible");

if (failures.length) {
  console.error("\n" + failures.map((f) => `✗ ${f}`).join("\n"));
  console.error("\nVer db/migrations/0043_residence_private_details.sql y 0043b_drop_residence_sensitive_columns.sql.");
  process.exit(1);
}
console.log("\n✓ Ninguna columna sensible es legible con la anon key.");
