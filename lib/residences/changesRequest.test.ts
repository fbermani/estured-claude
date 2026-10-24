import { describe, expect, it } from "vitest";
import {
  CHANGES_MESSAGE_MAX,
  SUBMITTABLE_RESIDENCE_STATUSES,
  VERIFICATION_STATUSES_RESET_ON_SUBMIT,
  changesRequestedMessageOrFallback,
  isMissingColumnError,
  isResubmission,
  validateChangesMessage,
} from "./changesRequest";

describe("validateChangesMessage", () => {
  it("rechaza vacío, solo espacios y menos de 10 caracteres", () => {
    for (const v of [undefined, null, "", "   ", "corto", "  123456789  "]) {
      expect(validateChangesMessage(v).ok).toBe(false);
    }
  });
  it("acepta 10 caracteres recortados y el máximo exacto", () => {
    expect(validateChangesMessage("  Subí 3 fotos  ")).toEqual({ ok: true, value: "Subí 3 fotos" });
    expect(validateChangesMessage("x".repeat(CHANGES_MESSAGE_MAX)).ok).toBe(true);
  });
  it("rechaza más de 1000 caracteres", () => {
    expect(validateChangesMessage("x".repeat(CHANGES_MESSAGE_MAX + 1)).ok).toBe(false);
  });
});

describe("transición de reenvío", () => {
  it("solo draft, needs_changes y verification_expired pueden enviarse a revisión", () => {
    expect([...SUBMITTABLE_RESIDENCE_STATUSES]).toEqual(["draft", "needs_changes", "verification_expired"]);
    for (const s of ["pending_verification", "verification_scheduled", "verified_active", "suspended", "paused_by_admin"]) {
      expect((SUBMITTABLE_RESIDENCE_STATUSES as readonly string[]).includes(s)).toBe(false);
    }
  });
  it("la verificación solo vuelve a documents_pending desde not_started, needs_changes o expired", () => {
    expect([...VERIFICATION_STATUSES_RESET_ON_SUBMIT]).toEqual(["not_started", "needs_changes", "expired"]);
  });
  it("isResubmission distingue needs_changes", () => {
    expect(isResubmission("needs_changes")).toBe(true);
    expect(isResubmission("verification_expired")).toBe(true);
    expect(isResubmission("draft")).toBe(false);
    expect(isResubmission(null)).toBe(false);
  });
});

describe("isMissingColumnError", () => {
  it("detecta columna inexistente (0048 sin aplicar) y no otros errores", () => {
    expect(isMissingColumnError({ code: "42703", message: "x" })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204", message: "x" })).toBe(true);
    expect(isMissingColumnError({ message: "column residence_verifications.changes_requested_message does not exist" })).toBe(true);
    expect(isMissingColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe("changesRequestedMessageOrFallback", () => {
  it("usa el mensaje y cae al genérico si es null o vacío", () => {
    expect(changesRequestedMessageOrFallback(" Falta el reglamento ")).toEqual({ text: "Falta el reglamento", generic: false });
    expect(changesRequestedMessageOrFallback(null).generic).toBe(true);
    expect(changesRequestedMessageOrFallback("  ").generic).toBe(true);
  });
});
