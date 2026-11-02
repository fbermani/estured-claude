import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test de cobertura (Ciclo 73, DR10): la auditoría de lo que se hace dentro de una residencia tiene que salir con el rol REAL del vínculo
 * (`residenceActorRole(membership)`), no con `residence_owner` escrito a mano: si actúa un staff, queda `residence_staff`.
 *
 * Falla si aparece `actorRole: "residence_owner"` o `changed_by_role: "residence_owner"` hardcodeado en `lib/**` o `app/residence/**`.
 * Excepciones legítimas (la acción solo la hace el dueño, por construcción): `lib/team` (invitar/cancelar/quitar acceso: solo dueño,
 * `assertResidenceOwner`) `addResidenceForOwner` (sumar una residencia es solo del dueño) y `residenceSignup/signupRequests` (el alta por invitación crea al dueño: no hay vínculo previo del que leer el rol). Los tests no cuentan.
 */
const ROOT = process.cwd();
const SCAN_DIRS = ["lib", join("app", "residence")];
const EXCLUDED = [join("lib", "team") + sep, join("lib", "residences", "addResidenceForOwner.ts"), join("lib", "residenceSignup", "signupRequests.ts")];
const HARDCODED = /\b(?:actorRole|actor_role|changed_by_role)\s*:\s*["']residence_owner["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("auditoría con el rol real de la residencia (DR10)", () => {
  it("no hay actorRole / changed_by_role 'residence_owner' hardcodeado fuera de las excepciones", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
        if (EXCLUDED.some((e) => rel === e || rel.startsWith(e))) continue;
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (HARDCODED.test(line)) offenders.push(`${rel}:${i + 1}`);
        });
      }
    }
    expect(offenders, `Usá residenceActorRole(membership) en vez del literal:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("el detector reconoce los dos literales (el test no pasa por no mirar nada)", () => {
    expect(HARDCODED.test('    actorRole: "residence_owner",')).toBe(true);
    expect(HARDCODED.test('    changed_by_role: "residence_owner",')).toBe(true);
    expect(HARDCODED.test("    actorRole,")).toBe(false);
    expect(HARDCODED.test('    actorRole: "residence_staff",')).toBe(false);
  });
});
