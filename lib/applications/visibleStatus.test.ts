import { describe, it, expect } from "vitest";
import {
  getVisibleStatus,
  studentActionRequired,
  KNOWN_APPLICATION_STATUSES,
  KNOWN_RESERVATION_STATUSES,
  type VisibleStatusViewer,
} from "@/lib/applications/visibleStatus";

const VIEWERS: VisibleStatusViewer[] = ["student", "residence", "admin"];

/** Los 19 estados técnicos de solicitud de docs/04 §5.2 — todos deben tener rótulo propio. */
const OFFICIAL_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "queued_for_place",
  "under_review",
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "paused_due_to_other_active_request",
  "residence_payment_pending",
  "residence_payment_reported",
  "converted_to_reservation",
  "rejected",
  "expired_no_residence_response",
  "expired_no_student_payment",
  "expired_offer_no_response",
  "cancelled_by_student",
  "cancelled_by_residence",
  "closed_due_to_other_confirmed_reservation",
  "disputed",
];

/** Los 12 estados técnicos de reserva de docs/04 §7.2. */
const OFFICIAL_RESERVATION_STATUSES = [
  "pending_estured_fee",
  "estured_fee_processing",
  "estured_fee_failed",
  "confirmed",
  "expired_fee_unpaid",
  "receipt_pending",
  "receipt_issued",
  "cancelled_by_student",
  "cancelled_by_residence",
  "no_show",
  "completed",
  "disputed",
];

describe("getVisibleStatus — solicitud sin reserva", () => {
  it("cubre los 19 estados oficiales de docs/04 §5.2 para los 3 roles, sin mostrar el código técnico", () => {
    for (const status of OFFICIAL_APPLICATION_STATUSES) {
      expect(KNOWN_APPLICATION_STATUSES).toContain(status);
      for (const viewer of VIEWERS) {
        const v = getVisibleStatus({ applicationStatus: status, viewer });
        expect(v.label, `${status}/${viewer}`).not.toBe("");
        expect(v.label, `${status}/${viewer}`).not.toMatch(/_/);
        expect(v.source).toBe("application");
        expect(v.key).toBe(status);
      }
    }
  });

  it("estado desconocido: rótulo neutro, nunca el string crudo", () => {
    const v = getVisibleStatus({ applicationStatus: "estado_inventado", viewer: "student" });
    expect(v.key).toBe("unknown");
    expect(v.label).toBe("Estado en revisión");
    expect(v.tone).toBe("neutral");
  });

  it("el estudiante tiene acción pendiente solo ante propuesta de ajuste o pago a la residencia", () => {
    const needing = OFFICIAL_APPLICATION_STATUSES.filter((s) => studentActionRequired(s));
    expect(needing.sort()).toEqual(["offer_pending_student_acceptance", "residence_payment_pending"].sort());
    expect(getVisibleStatus({ applicationStatus: "offer_pending_student_acceptance", viewer: "student" }).nextAction).toBe(
      "respond_offer",
    );
    expect(getVisibleStatus({ applicationStatus: "residence_payment_pending", viewer: "student" }).nextAction).toBe(
      "pay_residence",
    );
  });

  it("marca como cerradas las solicitudes terminales", () => {
    for (const s of [
      "rejected",
      "expired_no_residence_response",
      "expired_no_student_payment",
      "expired_offer_no_response",
      "cancelled_by_student",
      "cancelled_by_residence",
      "closed_due_to_other_confirmed_reservation",
    ]) {
      expect(getVisibleStatus({ applicationStatus: s, viewer: "student" }).isClosed, s).toBe(true);
    }
    expect(getVisibleStatus({ applicationStatus: "submitted", viewer: "student" }).isClosed).toBe(false);
  });

  it("converted_to_reservation sin reserva legible: rótulo oficial 'Reserva en proceso' y NUNCA 'ya podés pagar el fee'", () => {
    const v = getVisibleStatus({ applicationStatus: "converted_to_reservation", viewer: "student" });
    expect(v.label).toBe("Reserva en proceso");
    expect(v.helper).not.toMatch(/pagar el fee/i);
    expect(v.nextAction).toBeNull();
  });

  it("el rótulo difiere por rol donde el contexto cambia (estudiante / residencia / admin)", () => {
    expect(getVisibleStatus({ applicationStatus: "residence_payment_pending", viewer: "student" }).label).toBe("Pagá a la residencia");
    expect(getVisibleStatus({ applicationStatus: "residence_payment_pending", viewer: "residence" }).label).toBe(
      "Esperando pago del estudiante",
    );
    expect(getVisibleStatus({ applicationStatus: "cancelled_by_student", viewer: "student" }).label).toBe("Cancelada por vos");
    expect(getVisibleStatus({ applicationStatus: "cancelled_by_student", viewer: "residence" }).label).toBe(
      "Cancelada por el estudiante",
    );
  });
});

describe("getVisibleStatus — la reserva manda", () => {
  const converted = "converted_to_reservation";

  it("cubre los 12 estados oficiales de docs/04 §7.2 para los 3 roles", () => {
    for (const status of OFFICIAL_RESERVATION_STATUSES) {
      expect(KNOWN_RESERVATION_STATUSES).toContain(status);
      for (const viewer of VIEWERS) {
        const v = getVisibleStatus({ applicationStatus: converted, reservation: { status }, viewer });
        expect(v.label, `${status}/${viewer}`).not.toBe("");
        expect(v.label, `${status}/${viewer}`).not.toMatch(/_/);
        expect(v.source).toBe("reservation");
      }
    }
  });

  it("con reserva, el estado de la residencia viene de la reserva (source) y nunca del texto fijo de solicitud", () => {
    // ApplicationActions usa `helper || label` para source "reservation": el label nunca puede quedar vacío
    // ni decir que la reserva "está en proceso" cuando está cerrada.
    for (const status of ["cancelled_by_residence", "no_show", "completed", "receipt_issued", "disputed"]) {
      const v = getVisibleStatus({ applicationStatus: converted, reservation: { status }, viewer: "residence" });
      expect(v.source).toBe("reservation");
      expect(v.helper || v.label, status).not.toBe("");
      expect(v.helper ?? "", status).not.toMatch(/marcaste el pago/i);
    }
  });

  it("pending_estured_fee: único estado donde el estudiante ve 'pagá el fee' y tiene el CTA de pago", () => {
    const v = getVisibleStatus({ applicationStatus: converted, reservation: { status: "pending_estured_fee" }, viewer: "student" });
    expect(v.label).toBe("Pagá el fee EstuRed");
    expect(v.helper).toMatch(/pagar el fee/i);
    expect(v.studentActionRequired).toBe(true);
    expect(v.nextAction).toBe("pay_fee");

    for (const status of OFFICIAL_RESERVATION_STATUSES.filter((s) => s !== "pending_estured_fee")) {
      const other = getVisibleStatus({ applicationStatus: converted, reservation: { status }, viewer: "student" });
      expect(other.nextAction, status).not.toBe("pay_fee");
      expect(other.helper, status).not.toMatch(/ya podés pagar el fee/i);
    }
  });

  it("pending_manual_payment: comprobante del fee ya enviado, esperando validación (no vuelve a pedir el pago)", () => {
    const v = getVisibleStatus({
      applicationStatus: converted,
      reservation: { status: "pending_estured_fee", feePaymentStatus: "pending_manual_payment" },
      viewer: "student",
    });
    expect(v.key).toBe("pending_manual_payment");
    expect(v.label).toBe("Fee en validación");
    expect(v.studentActionRequired).toBe(false);
    expect(v.nextAction).toBe("view_fee_status");
    // Con el fee todavía sin elegir medio de pago sigue siendo "Pagá el fee".
    const pending = getVisibleStatus({
      applicationStatus: converted,
      reservation: { status: "pending_estured_fee", feePaymentStatus: "pending_payment_method" },
      viewer: "student",
    });
    expect(pending.key).toBe("pending_estured_fee");
  });

  it("confirmed / receipt_pending / receipt_issued se muestran como 'Reserva confirmada' (antes receipt_* caían en 'fee pendiente')", () => {
    for (const status of ["confirmed", "receipt_pending", "receipt_issued"]) {
      for (const viewer of VIEWERS) {
        const v = getVisibleStatus({ applicationStatus: converted, reservation: { status }, viewer });
        expect(v.label, `${status}/${viewer}`).toMatch(/^Reserva confirmada/);
        expect(v.tone).toBe("sage");
      }
    }
  });

  it("'Ver comprobante' solo cuando el comprobante existe", () => {
    expect(
      getVisibleStatus({ applicationStatus: converted, reservation: { status: "confirmed", hasReceipt: true }, viewer: "student" })
        .nextAction,
    ).toBe("view_receipt");
    expect(
      getVisibleStatus({ applicationStatus: converted, reservation: { status: "confirmed", hasReceipt: false }, viewer: "student" })
        .nextAction,
    ).toBeNull();
  });

  it("expired_fee_unpaid: mensaje claro, sin culpar al usuario, con salida por Soporte", () => {
    const v = getVisibleStatus({ applicationStatus: converted, reservation: { status: "expired_fee_unpaid" }, viewer: "student" });
    expect(v.label).toBe("Reserva vencida");
    expect(v.isClosed).toBe(true);
    expect(v.nextAction).toBe("contact_support");
    expect(v.helper).toMatch(/Soporte/);
    expect(v.helper).not.toMatch(/no pagaste|olvidaste|tu culpa|vos no/i);
    const residence = getVisibleStatus({ applicationStatus: converted, reservation: { status: "expired_fee_unpaid" }, viewer: "residence" });
    expect(residence.helper).toMatch(/liberar la plaza/);
  });

  it("cancelled_by_student, cancelled_by_residence y no_show: cerradas, neutras, con salida por Soporte para el estudiante", () => {
    const cancelled = getVisibleStatus({ applicationStatus: converted, reservation: { status: "cancelled_by_student" }, viewer: "student" });
    expect(cancelled.label).toBe("Reserva cancelada por vos");
    expect(cancelled.isClosed).toBe(true);
    expect(cancelled.nextAction).toBe("contact_support");

    const byResidence = getVisibleStatus({ applicationStatus: converted, reservation: { status: "cancelled_by_residence" }, viewer: "student" });
    expect(byResidence.label).toBe("Reserva cancelada por la residencia");
    expect(byResidence.isClosed).toBe(true);

    const noShow = getVisibleStatus({ applicationStatus: converted, reservation: { status: "no_show" }, viewer: "student" });
    expect(noShow.label).toBe("Ingreso no concretado");
    expect(noShow.isClosed).toBe(true);
  });

  it("revocación del fee (cancelled_by_student + student_revocation_right): copy propio", () => {
    const v = getVisibleStatus({
      applicationStatus: converted,
      reservation: { status: "cancelled_by_student", cancellationReasonCode: "student_revocation_right" },
      viewer: "student",
    });
    expect(v.key).toBe("revoked");
    expect(v.label).toBe("Reserva revocada por vos");
    expect(v.isClosed).toBe(true);
    // Una cancelación común sigue siendo "cancelada por vos".
    const plain = getVisibleStatus({
      applicationStatus: converted,
      reservation: { status: "cancelled_by_student", cancellationReasonCode: null },
      viewer: "student",
    });
    expect(plain.key).toBe("cancelled_by_student");
  });

  it("estured_fee_failed: tono de error y derivación a Soporte (no ofrece reintentar algo que la UI no permite)", () => {
    const v = getVisibleStatus({ applicationStatus: converted, reservation: { status: "estured_fee_failed" }, viewer: "student" });
    expect(v.tone).toBe("danger");
    expect(v.nextAction).toBe("contact_support");
    expect(v.studentActionRequired).toBe(false);
  });

  it("disputed: 'En revisión por EstuRed' (docs/04 §5.3) con Soporte", () => {
    const v = getVisibleStatus({ applicationStatus: converted, reservation: { status: "disputed" }, viewer: "student" });
    expect(v.label).toBe("En revisión por EstuRed");
    expect(v.helper).toMatch(/Soporte/);
  });

  it("estado de reserva desconocido: cae al de la solicitud, no inventa rótulo", () => {
    const v = getVisibleStatus({ applicationStatus: converted, reservation: { status: "estado_nuevo" }, viewer: "student" });
    expect(v.source).toBe("application");
    expect(v.key).toBe(converted);
  });

  it("si la reserva existe, manda aunque la solicitud no diga converted_to_reservation", () => {
    const v = getVisibleStatus({ applicationStatus: "residence_payment_reported", reservation: { status: "confirmed" }, viewer: "residence" });
    expect(v.source).toBe("reservation");
    expect(v.label).toBe("Reserva confirmada");
  });

  it("residencia y admin ven el estado real de las 3 reservas que antes se mostraban igual como 'Reserva'", () => {
    const labels = ["confirmed", "cancelled_by_student", "expired_fee_unpaid"].map((status) => ({
      residence: getVisibleStatus({ applicationStatus: converted, reservation: { status }, viewer: "residence" }).label,
      admin: getVisibleStatus({ applicationStatus: converted, reservation: { status }, viewer: "admin" }).label,
    }));
    expect(new Set(labels.map((l) => l.residence)).size).toBe(3);
    expect(new Set(labels.map((l) => l.admin)).size).toBe(3);
  });
});

describe("copy — reglas del proyecto", () => {
  it("nunca promete disponibilidad/garantías ni usa 'mediación'", () => {
    const FORBIDDEN = /garantiz|garantía|asegurad|mediaci[oó]n|whatsapp business/i;
    const reservationStatuses = [...OFFICIAL_RESERVATION_STATUSES];
    for (const viewer of VIEWERS) {
      for (const s of OFFICIAL_APPLICATION_STATUSES) {
        const v = getVisibleStatus({ applicationStatus: s, viewer });
        expect(`${v.label} ${v.helper}`, `${s}/${viewer}`).not.toMatch(FORBIDDEN);
      }
      for (const status of reservationStatuses) {
        const v = getVisibleStatus({ applicationStatus: "converted_to_reservation", reservation: { status }, viewer });
        expect(`${v.label} ${v.helper}`, `${status}/${viewer}`).not.toMatch(FORBIDDEN);
      }
    }
  });

  it("el helper del estudiante usa voseo, sin tuteo", () => {
    for (const status of OFFICIAL_RESERVATION_STATUSES) {
      const v = getVisibleStatus({ applicationStatus: "converted_to_reservation", reservation: { status }, viewer: "student" });
      expect(v.helper, status).not.toMatch(/\b(puedes|tienes|escríbenos|haz clic|quieres)\b/i);
    }
  });

  it("DR52: los estados vencidos tienen el mismo rótulo para estudiante, residencia y admin (solo cambia el helper)", () => {
    const app = (status: string, viewer: "student" | "residence" | "admin") =>
      getVisibleStatus({ applicationStatus: status as never, reservation: null, viewer }).label;
    for (const status of ["expired_no_residence_response", "expired_no_student_payment", "expired_offer_no_response"]) {
      expect(new Set([app(status, "student"), app(status, "residence"), app(status, "admin")]).size).toBe(1);
    }
    const res = (viewer: "student" | "residence" | "admin") =>
      getVisibleStatus({ applicationStatus: "converted_to_reservation" as never, reservation: { status: "expired_fee_unpaid" }, viewer }).label;
    expect(new Set([res("student"), res("residence"), res("admin")])).toEqual(new Set(["Reserva vencida"]));
  });
});

