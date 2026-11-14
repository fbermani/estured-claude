import { describe, expect, it } from "vitest";
import { isInProgressApplication } from "@/lib/applications/activeApplication";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";

const inProgress = (applicationStatus: string, reservation?: Parameters<typeof getVisibleStatus>[0]["reservation"]) =>
  isInProgressApplication(getVisibleStatus({ applicationStatus, reservation, viewer: "admin" }), applicationStatus);

describe("isInProgressApplication", () => {
  it("cuenta los estados activos de docs/04 §5.2", () => {
    for (const s of ["submitted", "under_review", "contact_established", "residence_payment_pending", "residence_payment_reported"]) {
      expect(inProgress(s)).toBe(true);
    }
  });

  it("no cuenta borrador, pausada ni estados terminales", () => {
    for (const s of ["draft", "paused_due_to_other_active_request", "rejected", "expired_no_student_payment", "cancelled_by_residence", "closed_due_to_other_confirmed_reservation"]) {
      expect(inProgress(s)).toBe(false);
    }
  });

  it("con reserva manda la reserva, no el estado persistido de la solicitud", () => {
    expect(inProgress("converted_to_reservation", { status: "pending_estured_fee" })).toBe(true);
    expect(inProgress("converted_to_reservation", { status: "confirmed" })).toBe(false);
    expect(inProgress("converted_to_reservation", { status: "expired_fee_unpaid" })).toBe(false);
    expect(inProgress("converted_to_reservation", { status: "cancelled_by_student", cancellationReasonCode: "student_revocation_right" })).toBe(false);
  });
});
