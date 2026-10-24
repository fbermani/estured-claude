import { describe, expect, it } from "vitest";
import { describeFeeBanner, familyFeePayerNote, resolveFeePayerView, sortPendingFees } from "@/lib/payments/feeUrgentBanner";

const now = new Date("2026-10-24T15:00:00Z");

describe("describeFeeBanner", () => {
  it("sin plazo, inválido o vencido no hay aviso", () => {
    expect(describeFeeBanner(null, now)).toBeNull();
    expect(describeFeeBanner("basura", now)).toBeNull();
    expect(describeFeeBanner("2026-10-24T14:59:00Z", now)).toBeNull();
  });
  it("menos de 24 h es urgente; 24 h o más no", () => {
    expect(describeFeeBanner("2026-10-25T14:59:00Z", now)?.urgent).toBe(true);
    expect(describeFeeBanner("2026-10-25T15:00:00Z", now)?.urgent).toBe(false);
  });
  it("formatea DD/MM HH:mm en hora de Buenos Aires", () => {
    expect(describeFeeBanner("2026-10-25T17:30:00Z", now)?.absolute).toBe("25/10 14:30");
  });
});

describe("resolveFeePayerView", () => {
  const base = { viewerUserId: "fam", studentUserId: "stu", viewerCanPay: true };
  it("el familiar es el pagador", () => expect(resolveFeePayerView({ ...base, payerUserId: "fam" })).toBe("viewer_pays"));
  it("sin permiso de pagar no cuenta como pagador", () =>
    expect(resolveFeePayerView({ ...base, payerUserId: "fam", viewerCanPay: false })).toBe("none"));
  it("paga el estudiante", () => expect(resolveFeePayerView({ ...base, payerUserId: "stu" })).toBe("student_pays"));
  it("nadie que pueda", () => expect(resolveFeePayerView({ ...base, payerUserId: "otro" })).toBe("none"));
});

describe("familyFeePayerNote", () => {
  it("copy por caso", () => {
    expect(familyFeePayerNote("viewer_pays", "Lucía")).toBeNull();
    expect(familyFeePayerNote("student_pays", "Lucía")).toBe("Lo paga Lucía.");
    expect(familyFeePayerNote("none", "Lucía")).toBe("Pedile a Lucía que te designe como pagador.");
  });
});

describe("sortPendingFees", () => {
  it("descarta vencidos y ordena por vencimiento", () => {
    const out = sortPendingFees(
      [
        { id: "b", expiresAt: "2026-10-27T00:00:00Z" },
        { id: "x", expiresAt: "2026-10-20T00:00:00Z" },
        { id: "a", expiresAt: "2026-10-25T00:00:00Z" },
        { id: "n", expiresAt: null },
      ],
      now,
    );
    expect(out.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
