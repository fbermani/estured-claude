import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Vitest no carga .env.local como Next.js. Los tests de integración
 * (ver lib/reservations/confirmAfterFeePaid.test.ts) necesitan las
 * credenciales reales de Supabase — se parsean acá a mano en vez de
 * sumar una dependencia nueva solo para esto.
 */
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Los tests de actions corren sin CAPTCHA (fail-open fuera de producción); lib/security/turnstile.test.ts usa vi.stubEnv.
delete process.env.TURNSTILE_SECRET_KEY;
delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Guard H26 (auditoría 2026-10-20): los tests de integración crean y borran
 * filas reales. Nunca deben correr contra producción — hacen falta
 * credenciales de un proyecto de desarrollo en .env.local. La lista de
 * refs protegidos vive en scripts/production-refs.json.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const protectedRefs: string[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/production-refs.json"), "utf-8"),
).refs;
const currentRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
if (currentRef && protectedRefs.includes(currentRef)) {
  throw new Error(
    `Los tests de integración se niegan a correr contra el proyecto de PRODUCCIÓN (${currentRef}). ` +
      "Apuntá NEXT_PUBLIC_SUPABASE_URL y las claves de .env.local al proyecto estured-dev.",
  );
}
