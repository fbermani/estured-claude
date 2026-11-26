import { describe, expect, it } from "vitest";

import { consentVersion, legalTextHash } from "@/lib/legal/consentVersion";
import { DATED_CONSENT_VERSION, LEGAL_DOCUMENTS } from "@/lib/legal/versions";

describe("consentVersion (LEG-012)", () => {
  it("los textos registrados llevan fecha + hash de 16 hex, distinto por texto", () => {
    for (const key of Object.keys(LEGAL_DOCUMENTS) as (keyof typeof LEGAL_DOCUMENTS)[]) {
      expect(consentVersion(key)).toMatch(new RegExp(`^${LEGAL_DOCUMENTS[key].version}\\+sha256:[0-9a-f]{16}$`));
    }
    expect(legalTextHash("terms")).not.toBe(legalTextHash("privacy"));
    expect(legalTextHash("terms")).toBe(legalTextHash("terms"));
  });

  it("un tipo sin texto registrado usa la versión con fecha, nunca el viejo borrador", () => {
    expect(consentVersion("student_visibility")).toBe(DATED_CONSENT_VERSION);
    expect(consentVersion("residence_payment_received")).not.toMatch(/borrador/);
  });
});

describe("fecha del pie", () => {
  it("es la del texto legal más reciente, incluidos los de la preapertura", async () => {
    const { LEGAL_TEXTS_UPDATED_LABEL, PREAPERTURA_LEGAL } = await import("@/lib/legal/versions");
    const newest = [...Object.values(LEGAL_DOCUMENTS), PREAPERTURA_LEGAL].sort((a, b) => b.version.localeCompare(a.version))[0];
    expect(LEGAL_TEXTS_UPDATED_LABEL).toBe(newest.updatedLabel);
  });
});
