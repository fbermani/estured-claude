import { describe, expect, it } from "vitest";
import { buildRevocationEmail } from "@/lib/revocations/revocationEmail";

describe("buildRevocationEmail (DR65 (b))", () => {
  it("incluye el código de seguimiento, escapa el nombre de la residencia y no promete nada sobre lo pagado a la residencia", () => {
    const email = buildRevocationEmail({
      reservationId: "3f2b8c1e-7a4d-4b6f-9c2a-1d5e8f0a3b7c",
      residenceName: "Residencia <Norte>",
      revokedAtIso: "2026-11-22T15:00:00.000Z",
      firstName: null,
    });
    expect(email.trackingCode).toBe("ARR-3F2B8C1E7A");
    expect(email.html).toContain("ARR-3F2B8C1E7A");
    expect(email.html).toContain("Residencia &lt;Norte&gt;");
    expect(email.html).toContain("22/11/2026");
    expect(email.html).toMatch(/se acuerda con la residencia/);
    expect(email.html).not.toMatch(/uso indebido|garantiz/i);
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});
