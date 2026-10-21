import { describe, expect, it } from "vitest";
import { auditActionPhrase, auditActorLabel } from "./auditActionLabels";

describe("auditActionPhrase", () => {
  it("traduce las claves técnicas que el dashboard mostraba crudas", () => {
    expect(auditActionPhrase("user_blocked")).toBe("bloqueó a un usuario");
    expect(auditActionPhrase("residence_paused_by_admin")).toBe("pausó una residencia");
    expect(auditActionPhrase("family_proposal_expired")).toBe("venció una propuesta de familiar");
  });
  it("una clave desconocida nunca se muestra cruda", () => {
    expect(auditActionPhrase("algo_nuevo_sin_mapear")).toBe("registró una actividad");
    expect(auditActorLabel("residence_owner")).toBe("Residencia");
    expect(auditActorLabel("???")).toBe("Usuario");
  });
});
