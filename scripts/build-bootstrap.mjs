/**
 * Arma el SQL único para inicializar un proyecto Supabase vacío con TODAS las migraciones
 * de db/migrations en orden (0001 … 0046, con la 0043b después de la 0043).
 *
 *   node scripts/build-bootstrap.mjs dev    → db/_generated/dev_bootstrap.sql  (sin el cron de la 0013)
 *   node scripts/build-bootstrap.mjs prod   → db/_generated/prod_bootstrap.sql (con el cron de la 0013:
 *                                              hay que reemplazar REEMPLAZAR-CON-TU-DOMINIO y
 *                                              REEMPLAZAR-CON-TU-CRON-SECRET antes de ejecutarlo)
 *
 * Solo sirve para una base VACÍA (no es re-ejecutable). El resultado está en .gitignore.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const target = process.argv[2];
if (target !== "dev" && target !== "prod") {
  console.error("Uso: node scripts/build-bootstrap.mjs dev|prod");
  process.exit(1);
}

const dir = new URL("../db/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const parts = [
  `-- EstuRed — bootstrap de ${target.toUpperCase()} (generado, no commitear).\n` +
    `-- Une ${files.length} migraciones en orden (${files[0].slice(0, 4)} … ${files[files.length - 1].slice(0, 5)}). Solo para una base VACÍA.\n` +
    (target === "prod"
      ? "-- ANTES de ejecutar: reemplazá REEMPLAZAR-CON-TU-DOMINIO (dominio real, sin https://) y REEMPLAZAR-CON-TU-CRON-SECRET en el bloque de la 0013 (se guarda en Supabase Vault; mismo valor que CRON_SECRET en Vercel).\n"
      : "-- El cron de la 0013 está comentado a propósito: en dev no debe pegarle a producción.\n"),
];

for (const f of files) {
  let sql = readFileSync(new URL(f, dir), "utf-8");
  if (f.startsWith("0013") && target === "dev") {
    sql = sql.replace(
      /^select cron\.schedule\(.*?^\);\n/ms,
      (m) => "-- [DEV] cron.schedule omitido:\n" + m.split("\n").map((l) => "-- " + l).join("\n") + "\n",
    );
    if (!sql.includes("[DEV] cron.schedule omitido")) throw new Error("No pude comentar el cron de la 0013");
  }
  if (f.startsWith("0013") && target === "prod") {
    // B8: el secreto del cron se lee del Vault en cada ejecución (no queda en texto plano en cron.job.command).
    const before = sql;
    sql = sql.replace(
      /^select cron\.schedule\(/m,
      "-- Guarda el secreto en Vault (mismo valor que CRON_SECRET en Vercel):\n" +
        "select vault.create_secret('REEMPLAZAR-CON-TU-CRON-SECRET', 'cron_secret');\nselect cron.schedule(",
    ).replace(
      /headers := jsonb_build_object\('Authorization', 'Bearer REEMPLAZAR-CON-TU-CRON-SECRET'\)/,
      "headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))",
    );
    if (sql === before || !sql.includes("vault.decrypted_secrets")) throw new Error("No pude aplicar la variante Vault a la 0013");
  }
  parts.push(`\n-- ====================== ${basename(f)} ======================\n${sql}\n`);
}

mkdirSync(new URL("../db/_generated/", import.meta.url), { recursive: true });
const out = new URL(`../db/_generated/${target}_bootstrap.sql`, import.meta.url);
writeFileSync(out, parts.join(""));
console.log(`✓ ${files.length} migraciones → db/_generated/${target}_bootstrap.sql`);
console.log("Orden:", files.map((f) => f.slice(0, 5)).join(" "));
