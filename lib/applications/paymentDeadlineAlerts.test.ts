import { describe, expect, it } from "vitest";
import {
  dueAlertStage,
  nextAlertStage,
  deadlineParts,
  studentAlertCopy,
  residenceLastAlertCopy,
  newWindowStudentCopy,
  newWindowResidenceCopy,
  shouldOpenNewWindow,
  NEW_WINDOW_START_STAGE,
} from "@/lib/applications/paymentDeadlineAlerts";

const H = 3_600_000;
const deadline = "2026-11-29T15:00:00.000Z"; // 12:00 en Buenos Aires
const at = (hoursBefore: number) => new Date(new Date(deadline).getTime() - hoursBefore * H);

describe("dueAlertStage", () => {
  it("cuenta las etapas por el tiempo que falta", () => {
    expect(dueAlertStage(deadline, at(48))).toBe(0);
    expect(dueAlertStage(deadline, at(36))).toBe(1);
    expect(dueAlertStage(deadline, at(30))).toBe(1);
    expect(dueAlertStage(deadline, at(24))).toBe(2);
    expect(dueAlertStage(deadline, at(12))).toBe(3);
    expect(dueAlertStage(deadline, at(6))).toBe(4);
    expect(dueAlertStage(deadline, at(1))).toBe(4);
  });
  it("no alerta con el plazo vencido o inválido", () => {
    expect(dueAlertStage(deadline, at(-1))).toBe(0);
    expect(dueAlertStage(null, at(10))).toBe(0);
    expect(dueAlertStage("no-es-fecha", at(10))).toBe(0);
  });
});

describe("nextAlertStage", () => {
  it("manda la etapa que corresponde y no repite", () => {
    expect(nextAlertStage({ deadlineIso: deadline, now: at(36), sentStage: 0, sentFor: null })).toBe(1);
    expect(nextAlertStage({ deadlineIso: deadline, now: at(30), sentStage: 1, sentFor: deadline })).toBeNull();
  });
  it("con el cron atrasado salta a la última que corresponde", () => {
    expect(nextAlertStage({ deadlineIso: deadline, now: at(5), sentStage: 1, sentFor: deadline })).toBe(4);
  });
  it("si el plazo cambió, la cuenta vuelve a empezar", () => {
    const other = "2026-11-27T15:00:00.000Z";
    expect(nextAlertStage({ deadlineIso: deadline, now: at(36), sentStage: 4, sentFor: other })).toBe(1);
  });
  it("en el plazo nuevo de 24 h arranca después de la etapa de 24 h", () => {
    expect(nextAlertStage({ deadlineIso: deadline, now: at(24), sentStage: NEW_WINDOW_START_STAGE, sentFor: deadline })).toBeNull();
    expect(nextAlertStage({ deadlineIso: deadline, now: at(12), sentStage: NEW_WINDOW_START_STAGE, sentFor: deadline })).toBe(3);
  });
});

describe("textos", () => {
  it("formatea fecha y hora en Buenos Aires", () => {
    expect(deadlineParts(deadline)).toEqual({ fecha: "29/11", hora: "12:00" });
  });
  it("no duplica el punto después de la inicial", () => {
    const input = { studentName: "Lucía F.", deadlineIso: deadline };
    expect(residenceLastAlertCopy({ ...input, isMinor: false }).body).toContain("la reserva de Lucía F. Vence");
    expect(newWindowResidenceCopy(input).body).toContain("el pago de Lucía F. Si ya");
    expect(newWindowResidenceCopy({ ...input, studentName: "Lucía" }).body).toContain("el pago de Lucía. Si ya");
  });
  it("estudiante, familiar y menor", () => {
    const base = { stage: 1, residenceName: "Residencia Norte", studentName: "Lucía F.", deadlineIso: deadline };
    expect(studentAlertCopy({ ...base, audience: "student" })).toEqual({
      title: "Tenés un pago pendiente",
      body: "Pagá la reserva en Residencia Norte y tocá «Ya pagué» antes del 29/11 a las 12:00. Si no, la solicitud puede vencer. ¿Tenés un problema? Escribí a Soporte antes de esa hora.",
    });
    expect(studentAlertCopy({ ...base, stage: 4, audience: "family" }).body).toMatch(/^Pagá la reserva de Lucía F\. en Residencia Norte/);
    expect(studentAlertCopy({ ...base, stage: 4, audience: "family" }).title).toBe("Último aviso para pagar la reserva");
    expect(studentAlertCopy({ ...base, audience: "minor_student" }).body).toBe(
      "Tu familiar vinculado tiene que pagar la reserva en Residencia Norte y avisarlo antes del 29/11 a las 12:00. Si no, la solicitud puede vencer.",
    );
  });
  it("residencia a las 42 h", () => {
    expect(residenceLastAlertCopy({ studentName: "Lucía F.", deadlineIso: deadline, isMinor: true }).body).toContain("Podés escribirle al familiar vinculado");
  });
  it("no lleva montos", () => {
    const body = newWindowStudentCopy({ audience: "student", residenceName: "R", studentName: "L", deadlineIso: deadline }).body;
    expect(body).not.toMatch(/\$|USD|ARS/);
  });
});

describe("shouldOpenNewWindow", () => {
  const now = at(-2);
  it("solo con el plazo vencido y nada más que lo frene", () => {
    expect(shouldOpenNewWindow({ applicationStatus: "residence_payment_pending", deadlineIso: deadline, now, heldByPayment: false })).toBe(true);
    expect(shouldOpenNewWindow({ applicationStatus: "residence_payment_pending", deadlineIso: deadline, now, heldByPayment: true })).toBe(false);
    expect(shouldOpenNewWindow({ applicationStatus: "residence_payment_pending", deadlineIso: deadline, now: at(3), heldByPayment: false })).toBe(false);
    expect(shouldOpenNewWindow({ applicationStatus: "converted_to_reservation", deadlineIso: deadline, now, heldByPayment: false })).toBe(false);
  });
});
