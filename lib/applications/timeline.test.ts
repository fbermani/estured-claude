import { describe, expect, it } from "vitest";
import { buildApplicationTimeline } from "@/lib/applications/timeline";

const base = { createdAt: "2026-07-01T10:00:00Z", isClosed: false };
const states = (steps: ReturnType<typeof buildApplicationTimeline>) => steps.map((s) => s.state);

describe("buildApplicationTimeline", () => {
  it("solicitud recién enviada: solo el primer paso hecho y el contacto es el actual", () => {
    const steps = buildApplicationTimeline({ ...base, applicationStatus: "submitted" });
    expect(states(steps)).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);
    expect(steps[0].at).toBe(base.createdAt);
  });

  it("contacto establecido: el pago a la residencia pasa a ser el actual", () => {
    const steps = buildApplicationTimeline({
      ...base,
      applicationStatus: "contact_established",
      contactEstablishedAt: "2026-07-02T10:00:00Z",
    });
    expect(states(steps)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expect(steps[1].at).toBe("2026-07-02T10:00:00Z");
  });

  it("reserva pendiente de fee: pago a la residencia hecho, fee actual", () => {
    const steps = buildApplicationTimeline({
      ...base,
      applicationStatus: "converted_to_reservation",
      reservationStatus: "pending_estured_fee",
    });
    expect(states(steps)).toEqual(["done", "done", "done", "current", "upcoming"]);
  });

  it("reserva confirmada: todo hecho", () => {
    const steps = buildApplicationTimeline({
      ...base,
      applicationStatus: "converted_to_reservation",
      reservationStatus: "receipt_issued",
      reservationConfirmedAt: "2026-07-10T10:00:00Z",
    });
    expect(states(steps)).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("un hito posterior implica los anteriores aunque falten timestamps", () => {
    const steps = buildApplicationTimeline({
      ...base,
      applicationStatus: "residence_payment_reported",
    });
    expect(states(steps)).toEqual(["done", "done", "done", "current", "upcoming"]);
    // sin timestamp conocido no se inventa una fecha
    expect(steps[1].at).toBeNull();
  });

  it("solicitud cerrada: el siguiente paso queda 'stopped' y los demás 'upcoming'", () => {
    const steps = buildApplicationTimeline({
      ...base,
      applicationStatus: "expired_no_residence_response",
      isClosed: true,
    });
    expect(states(steps)).toEqual(["done", "stopped", "upcoming", "upcoming", "upcoming"]);
  });

  it("reserva vencida por fee sin pagar: se detiene en el fee", () => {
    const steps = buildApplicationTimeline({
      ...base,
      applicationStatus: "converted_to_reservation",
      reservationStatus: "expired_fee_unpaid",
      isClosed: true,
    });
    expect(states(steps)).toEqual(["done", "done", "done", "stopped", "upcoming"]);
  });
});
