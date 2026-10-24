import { describe, expect, it } from "vitest";
import {
  FEE_PAGE_REVOCATION_NOTE,
  LEGAL_REVIEW_PENDING,
  REVOCATION_CONSEQUENCES,
  REVOCATION_NOT_ALLOWED_NOTE,
  REVOCATION_PAGE_INTRO,
  REVOCATION_PENDING_HELPER,
  REVOCATION_SUBMITTED_MESSAGE,
  REVOCATION_TERMS_PARAGRAPHS,
  REVOCATION_UNDERSTANDING_LABEL,
  deniedNotificationBody,
  refundedNotificationBody,
} from "@/lib/revocations/copy";

const ALL_COPY = [
  REVOCATION_PAGE_INTRO,
  ...REVOCATION_CONSEQUENCES,
  REVOCATION_UNDERSTANDING_LABEL,
  REVOCATION_SUBMITTED_MESSAGE,
  REVOCATION_PENDING_HELPER,
  REVOCATION_NOT_ALLOWED_NOTE,
  FEE_PAGE_REVOCATION_NOTE,
  ...REVOCATION_TERMS_PARAGRAPHS,
  refundedNotificationBody({ residenceName: "Residencia Norte", refundedAtIso: "2026-10-24T15:00:00.000Z" }),
  deniedNotificationBody({ residenceName: "Residencia Norte", studentMessage: "Mensaje." }),
];

describe("copy de la revocación (DR6)", () => {
  it("el texto legal está marcado como pendiente de revisión por un asesor", () => {
    expect(LEGAL_REVIEW_PENDING).toBe(true);
  });

  it("no usa palabras prohibidas ni jerga interna, ni promete garantías", () => {
    for (const text of ALL_COPY) {
      expect(text).not.toMatch(/mediaci[oó]n/i);
      expect(text).not.toMatch(/garantizad/i);
      expect(text).not.toMatch(/borrador/i);
      expect(text).not.toMatch(/docs\//i);
      expect(text).not.toMatch(/EstuRED/);
    }
  });

  it("dice lo que cubre y lo que no: reintegro del fee tras revisión, lo pagado a la residencia se acuerda con ella", () => {
    const joined = REVOCATION_CONSEQUENCES.join(" ");
    expect(joined).toMatch(/fee completo \(el 5%\)/);
    expect(joined).toMatch(/no es autom[aá]tico/i);
    expect(joined).toMatch(/se acuerda con la residencia/);
    // Ya no se contradice: no dice a la vez "tenés el derecho" y "no se reembolsa".
    expect(joined).not.toMatch(/no se reembolsa autom[aá]ticamente/i);
  });

  it("aclara que la revisión puede detectar un uso indebido (coherente con /terms §17)", () => {
    expect(REVOCATION_PAGE_INTRO).toMatch(/uso indebido/);
    expect(REVOCATION_CONSEQUENCES.join(" ")).toMatch(/uso indebido/);
  });

  it("el aviso de denegación incluye solo el mensaje al estudiante", () => {
    expect(deniedNotificationBody({ residenceName: null, studentMessage: null })).not.toMatch(/Mensaje del equipo/);
    expect(deniedNotificationBody({ residenceName: null, studentMessage: "Hola." })).toMatch(/Mensaje del equipo: Hola\./);
  });
});
