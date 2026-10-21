import { describe, expect, it } from "vitest";
import {
  LIVE_RESERVATION_STATUSES,
  NON_LIVE_RESERVATION_STATUSES,
  RESERVATION_STATUSES,
} from "@/lib/reservations/reservationStatus";

describe("reservationStatus", () => {
  it("son los 12 estados oficiales", () => {
    expect(RESERVATION_STATUSES).toHaveLength(12);
  });

  it("vigentes = todo menos fee vencido, canceladas, no_show y completed (fee fallido se puede reintentar)", () => {
    expect([...LIVE_RESERVATION_STATUSES].sort()).toEqual(
      ["confirmed", "disputed", "estured_fee_failed", "estured_fee_processing", "pending_estured_fee", "receipt_issued", "receipt_pending"].sort(),
    );
  });

  it("vigentes y no vigentes particionan los 12 estados", () => {
    expect(LIVE_RESERVATION_STATUSES.length + NON_LIVE_RESERVATION_STATUSES.length).toBe(RESERVATION_STATUSES.length);
    for (const status of NON_LIVE_RESERVATION_STATUSES) expect(LIVE_RESERVATION_STATUSES).not.toContain(status);
  });
});
