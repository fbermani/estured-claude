import { describe, expect, it } from "vitest";
import { getNextStep, stageForStatusKey, type JourneyApplication } from "./journeyStage";

const app = (over: Partial<JourneyApplication> = {}): JourneyApplication => ({
  id: "app-1",
  residenceName: "Casa Palermo",
  statusKey: "submitted",
  label: "Enviada",
  helper: "La residencia tiene 48 horas para responder.",
  studentActionRequired: false,
  ...over,
});

describe("stageForStatusKey", () => {
  it("mapea los estados a las 6 etapas", () => {
    expect(stageForStatusKey("under_review")).toBe(3);
    expect(stageForStatusKey("offer_pending_student_acceptance")).toBe(4);
    expect(stageForStatusKey("residence_payment_pending")).toBe(5);
    expect(stageForStatusKey("pending_estured_fee")).toBe(5);
    expect(stageForStatusKey("receipt_issued")).toBe(6);
  });
  it("un estado desconocido cae en Solicitud", () => {
    expect(stageForStatusKey("algo_nuevo")).toBe(3);
  });
});

describe("getNextStep", () => {
  it("perfil incompleto pero elegible: puede buscar y solicitar; el perfil es opcional", () => {
    const s = getNextStep({ profilePercent: 40, application: null });
    expect(s.stage).toBe(2);
    expect(s.primary.href).toBe("/search");
    expect(s.description).toMatch(/opcional/);
    expect(s.secondary?.href).toBe("/students/profile");
  });
  it("Camila: perfil al 44 % con todas las solicitudes cerradas no vuelve al paso Perfil", () => {
    const s = getNextStep({ profilePercent: 44, application: null, hadPreviousApplications: true });
    expect(s.stage).toBe(2);
    expect(s.title).toMatch(/Seguí buscando/);
    expect(s.title).not.toMatch(/perfil/i);
  });
  it("menor sin familiar vinculado: requisito real, lleva a vincular", () => {
    const s = getNextStep({ profilePercent: 100, application: null, minorWithoutLink: true });
    expect(s.stage).toBe(1);
    expect(s.primary.href).toBe("/students/dashboard#vinculacion");
  });
  it("una solicitud viva manda aunque el perfil esté incompleto o sea menor sin vínculo", () => {
    expect(getNextStep({ profilePercent: 10, application: app(), minorWithoutLink: true }).stage).toBe(3);
  });
  it("perfil completo sin solicitudes: etapa Buscar", () => {
    const s = getNextStep({ profilePercent: 100, application: null });
    expect(s.stage).toBe(2);
    expect(s.primary.href).toBe("/search");
  });
  it("solicitud cerrada: invita a seguir buscando, sin culpar al usuario", () => {
    const s = getNextStep({ profilePercent: 100, application: null, hadPreviousApplications: true });
    expect(s.stage).toBe(2);
    expect(s.title).toMatch(/Seguí buscando/);
  });
  it("solicitud en curso sin acción: lleva al detalle y usa el helper del estado", () => {
    const s = getNextStep({ profilePercent: 50, application: app() });
    expect(s.stage).toBe(3);
    expect(s.primary).toEqual({ label: "Ver mi solicitud", href: "/students/applications/app-1" });
    expect(s.description).toBe("La residencia tiene 48 horas para responder.");
  });
  it("propuesta pendiente de respuesta: etapa Propuesta con CTA específico", () => {
    const s = getNextStep({
      profilePercent: 100,
      application: app({ statusKey: "offer_pending_student_acceptance", studentActionRequired: true }),
    });
    expect(s.stage).toBe(4);
    expect(s.title).toBe("Revisá la propuesta de Casa Palermo");
    expect(s.primary.label).toBe("Ver propuesta");
  });
  it("sin helper usa el rótulo del estado", () => {
    expect(getNextStep({ profilePercent: 100, application: app({ helper: "" }) }).description).toBe("Enviada");
  });
});
