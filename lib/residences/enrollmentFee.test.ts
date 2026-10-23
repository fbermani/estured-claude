import { describe, expect, it } from "vitest";
import { describeEnrollmentFee } from "@/lib/residences/enrollmentFee";

describe("describeEnrollmentFee (DF4: modo null = no cobra matrícula)", () => {
  it("null -> no cobra", () => {
    expect(describeEnrollmentFee({ enrollmentFeeMode: null, enrollmentFeeUsd: null })).toEqual({ kind: "none" });
  });
  it("one_month -> equivale a un mes de renta", () => {
    expect(describeEnrollmentFee({ enrollmentFeeMode: "one_month", enrollmentFeeUsd: null })).toEqual({ kind: "one_month" });
  });
  it("manual con monto -> monto fijo", () => {
    expect(describeEnrollmentFee({ enrollmentFeeMode: "manual", enrollmentFeeUsd: 150 })).toEqual({ kind: "fixed", usd: 150 });
  });
  it("manual sin monto válido -> no cobra (el perfil exige el monto, defensa)", () => {
    expect(describeEnrollmentFee({ enrollmentFeeMode: "manual", enrollmentFeeUsd: null })).toEqual({ kind: "none" });
    expect(describeEnrollmentFee({ enrollmentFeeMode: "manual", enrollmentFeeUsd: 0 })).toEqual({ kind: "none" });
  });
});
