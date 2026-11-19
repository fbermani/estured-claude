import { describe, expect, it } from "vitest";
import { getVerificationProgress } from "./verificationStages";

const states = (status: string) => getVerificationProgress(status)?.stages.map((s) => s.state);

describe("getVerificationProgress", () => {
  it("siempre devuelve las cuatro etapas, en orden y con nombre", () => {
    const p = getVerificationProgress("draft");
    expect(p?.stages.map((s) => s.label)).toEqual(["Configuración", "En verificación", "Verificada", "Publicada"]);
    expect(p?.stages.map((s) => s.position)).toEqual([1, 2, 3, 4]);
  });

  it("draft: etapa 1 actual", () => {
    expect(states("draft")).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(getVerificationProgress("draft")?.alert).toBeNull();
  });

  it("needs_changes y verification_expired vuelven a la etapa 1 con aviso", () => {
    for (const status of ["needs_changes", "verification_expired"]) {
      const p = getVerificationProgress(status);
      expect(states(status)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
      expect(p?.chip.tone).toBe("warning");
      expect(p?.alert).toBeTruthy();
    }
    expect(getVerificationProgress("needs_changes")?.alert).toBe("Hay cambios para corregir");
  });

  it("pending_verification y verification_scheduled: etapa 2 y estado «En proceso de verificación»", () => {
    for (const status of ["pending_verification", "verification_scheduled"]) {
      const p = getVerificationProgress(status);
      expect(states(status)).toEqual(["done", "current", "upcoming", "upcoming"]);
      expect(p?.chip.label).toBe("En proceso de verificación");
      expect(p?.currentLine).toBe("Etapa 2 de 4: En verificación");
      expect(p?.complete).toBe(false);
    }
  });

  it("verified_active: verificada y publicada cumplen a la vez", () => {
    const p = getVerificationProgress("verified_active");
    expect(states("verified_active")).toEqual(["done", "done", "done", "done"]);
    expect(p?.complete).toBe(true);
    expect(p?.currentLine).toBe("Etapa 4 de 4: Publicada");
    expect(p?.chip.label).toBe("Verificada y publicada");
  });

  it("estados fuera del recorrido no muestran etapas", () => {
    for (const status of ["suspended", "paused_by_residence", "paused_by_admin", "archived", "otro"]) {
      expect(getVerificationProgress(status)).toBeNull();
    }
  });

  it("el estado de cada etapa tiene texto y no promete plazos ni garantías", () => {
    for (const status of ["draft", "needs_changes", "verification_expired", "pending_verification", "verification_scheduled", "verified_active"]) {
      const p = getVerificationProgress(status)!;
      for (const s of p.stages) expect(s.stateLabel.length).toBeGreaterThan(0);
      const copy = `${p.now} ${p.next} ${p.alert ?? ""} ${p.chip.label}`;
      expect(copy).not.toMatch(/mediaci[oó]n|garantiz|\d+\s*(h|hs|horas|días)/i);
    }
  });
});
