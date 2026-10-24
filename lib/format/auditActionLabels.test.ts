import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AUDIT_ACTION } from "@/lib/residences/verificationReview";
import {
  auditActionOptions,
  auditActionPhrase,
  auditActorLabel,
  auditEntityLabel,
  hasAuditActionLabel,
} from "./auditActionLabels";

describe("auditActionPhrase", () => {
  it("traduce las claves técnicas que el dashboard mostraba crudas", () => {
    expect(auditActionPhrase("user_blocked")).toBe("bloqueó a un usuario");
    expect(auditActionPhrase("residence_paused_by_admin")).toBe("pausó una residencia");
    expect(auditActionPhrase("family_proposal_expired")).toBe("venció una propuesta de familiar");
  });
  it("revocación del fee (DR6): reintegro y denegación tienen frase propia", () => {
    expect(auditActionPhrase("estured_fee_refunded_after_revocation")).toBe("reintegró un fee EstuRed tras una revocación");
    expect(auditActionPhrase("estured_fee_revocation_denied")).toBe("denegó la revocación de un fee EstuRed");
  });
  it("una clave desconocida nunca se muestra cruda", () => {
    expect(auditActionPhrase("algo_nuevo_sin_mapear")).toBe("registró una actividad");
    expect(auditActorLabel("residence_owner")).toBe("Residencia");
    expect(auditActorLabel("???")).toBe("Usuario");
  });
});

describe("cobertura de acciones (DR9)", () => {
  const root = process.cwd();
  // `action: "x"` también aparece en tipos/props que no son de auditoría.
  const NOT_AUDIT = new Set(["needs_changes"]);
  // Acciones armadas dinámicamente (template o mapa): se listan a mano.
  const DYNAMIC = [
    ...Object.values(AUDIT_ACTION),
    "negotiation_accepted",
    "negotiation_rejected_chose_original",
    "negotiation_rejected_closed",
    "residence_visibility_warning_issued",
    "residence_visibility_reduced",
    "residence_visibility_restored",
    "residence_profile_edit_approved",
    "residence_profile_edit_rejected",
    "residence_profile_edit_correction_requested",
  ];

  function walk(dir: string, out: string[]) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
  }

  it("toda acción de auditoría usada en el código tiene etiqueta humana", () => {
    const files: string[] = [];
    for (const d of ["app", "lib", "scripts"]) walk(join(root, d), files);
    const used = new Set<string>(DYNAMIC);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!src.includes("audit_logs") && !src.includes("createAuditLog")) continue;
      for (const line of src.split("\n")) {
        const m = line.match(/^\s*(?:action|auditAction)\s*[:=]\s*(.*)$/);
        if (!m) continue;
        // Solo literales en posición de valor (`: "x"` / `? "x"`), no los de la condición del ternario.
        for (const q of (":" + m[1]).matchAll(/[?:]\s*"([a-z]+(?:_[a-z0-9]+)+)"/g)) used.add(q[1]);
      }
    }
    for (const n of NOT_AUDIT) used.delete(n);
    const missing = [...used].filter((a) => !hasAuditActionLabel(a)).sort();
    expect(missing, `Acciones sin etiqueta en auditActionLabels.ts: ${missing.join(", ")}`).toEqual([]);
    expect(used.size).toBeGreaterThan(80);
  });

  it("el filtro de acciones lista todas las etiquetas y las entidades tienen nombre", () => {
    expect(auditActionOptions().length).toBeGreaterThan(100);
    expect(auditEntityLabel("residences")).toBe("Residencia");
    expect(auditEntityLabel("tabla_desconocida")).toBe("Otro");
  });
});
