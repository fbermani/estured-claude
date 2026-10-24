import { describe, expect, it } from "vitest";
import { buildTerminalSummary, isRevokedReservation, isTerminalVisibleStatus } from "@/lib/applications/terminalState";

const base = { createdAt: "2026-07-01T10:00:00Z", applicationStatus: "converted_to_reservation" };
const keys = (s: ReturnType<typeof buildTerminalSummary>) => s.steps.map((x) => x.key);

describe("isTerminalVisibleStatus", () => {
  it("cerrada sí, finalizada y vigente no", () => {
    expect(isTerminalVisibleStatus({ isClosed: true, key: "expired_fee_unpaid" })).toBe(true);
    expect(isTerminalVisibleStatus({ isClosed: true, key: "completed" })).toBe(false);
    expect(isTerminalVisibleStatus({ isClosed: false, key: "submitted" })).toBe(false);
  });
});

describe("isRevokedReservation", () => {
  it("solo cancelada por el estudiante con motivo de revocación", () => {
    expect(isRevokedReservation({ status: "cancelled_by_student", cancellationReasonCode: "student_revocation_right" })).toBe(true);
    expect(isRevokedReservation({ status: "cancelled_by_student", cancellationReasonCode: null })).toBe(false);
    expect(isRevokedReservation(null)).toBe(false);
  });
});

describe("buildTerminalSummary", () => {
  it("reserva vencida por fee: contacto y pago a la residencia hechos, sin fee ni confirmación", () => {
    const s = buildTerminalSummary({ ...base, reservationStatus: "expired_fee_unpaid", revoked: false });
    expect(keys(s)).toEqual(["sent", "contact", "residence_payment"]);
    expect(s.residencePaid).toBe(true);
    expect(s.feePaid).toBe(false);
  });
  it("revocada: no marca el fee como logrado aunque tenga fecha de pago", () => {
    const s = buildTerminalSummary({ ...base, reservationStatus: "cancelled_by_student", feePaidAt: "2026-07-05T10:00:00Z", revoked: true });
    expect(keys(s)).not.toContain("fee");
    expect(keys(s)).not.toContain("confirmed");
  });
  it("vencida sin respuesta de la residencia: solo el envío", () => {
    const s = buildTerminalSummary({ applicationStatus: "expired_no_residence_response", createdAt: base.createdAt, revoked: false });
    expect(keys(s)).toEqual(["sent"]);
    expect(s.residencePaid).toBe(false);
  });
  it("ingreso no concretado: el fee sí se pagó", () => {
    const s = buildTerminalSummary({ ...base, reservationStatus: "no_show", revoked: false });
    expect(s.feePaid).toBe(true);
    expect(keys(s)).not.toContain("confirmed");
  });
});
