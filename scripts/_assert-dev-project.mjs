/**
 * Guard H26 (auditoría 2026-10-20): los seeds de datos demo borran y
 * recrean filas. Nunca deben correr contra producción. Se importa por
 * efecto lateral al inicio de cada seed destructivo:
 *   import "./_assert-dev-project.mjs";
 * La lista de refs protegidos vive en scripts/production-refs.json.
 */
import { readFileSync } from "node:fs";

const { refs } = JSON.parse(readFileSync(new URL("./production-refs.json", import.meta.url), "utf-8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url ? new URL(url).hostname.split(".")[0] : "";
if (ref && refs.includes(ref)) {
  console.error(
    `✗ Este script borra/recrea datos demo y se niega a correr contra el proyecto de PRODUCCIÓN (${ref}).\n` +
      "  Apuntá .env.local al proyecto estured-dev.",
  );
  process.exit(1);
}
