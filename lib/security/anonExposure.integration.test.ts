import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regresión de privacidad (Ciclo 56, hallazgo de seguridad del Ciclo 55): con la ANON KEY (pública) no debe ser
 * legible ninguna columna sensible (dirección exacta, responsable, señal de calidad, auditoría de acceso a GO,
 * notas internas de disponibilidad) ni filas de las tablas privadas. Integración contra estured-dev (solo lee;
 * `vitest.setup.ts` ya se niega a correr contra producción). Requiere las migraciones 0043 y 0043b aplicadas.
 * Equivalente por script: `node --env-file=.env.local scripts/check-anon-exposure.mjs`.
 */
const { columns, privateTables } = JSON.parse(
  readFileSync(new URL("../../scripts/sensitive-columns.json", import.meta.url), "utf-8"),
) as { columns: Record<string, string[]>; privateTables: string[] };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(url && anon);

async function anonGet(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: anon!, Authorization: `Bearer ${anon}` } });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

describe.skipIf(!hasCreds)("anon key: columnas y tablas privadas (integración)", () => {
  for (const [table, cols] of Object.entries(columns)) {
    for (const col of cols) {
      it(`${table}.${col} no es legible con la anon key`, async () => {
        const { status } = await anonGet(`${table}?select=${col}&limit=1`);
        expect(status, `${table}.${col} respondió ${status}: debería fallar (columna inexistente o sin privilegio)`).not.toBe(200);
      });
    }
  }

  for (const table of privateTables) {
    it(`${table} no devuelve filas con la anon key`, async () => {
      const { status, body } = await anonGet(`${table}?select=*&limit=1`);
      if (status === 200) expect(body).toEqual([]);
    });
  }

  it("`residences?select=*` (lo que ve un visitante) no trae ninguna columna sensible", async () => {
    const { status, body } = await anonGet("residences?select=*&limit=50");
    expect(status).toBe(200);
    const rows = body as Record<string, unknown>[];
    const keys = new Set(rows.flatMap((r) => Object.keys(r)));
    for (const col of columns.residences) expect(keys.has(col), `residences.${col} sigue en la respuesta pública`).toBe(false);
  });

  it("el catálogo público sigue siendo legible (no se rompió la lectura de verificadas)", async () => {
    const { status, body } = await anonGet("residences?select=id,name,slug,public_area&status=eq.verified_active&limit=5");
    expect(status).toBe(200);
    expect((body as unknown[]).length).toBeGreaterThan(0);
  });
});
