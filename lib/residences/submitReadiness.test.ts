import { describe, expect, it } from "vitest";
import {
  computeSubmitReadiness,
  readinessHeadline,
  submitBlockedMessage,
  type SubmitReadinessConditions,
  type SubmitReadinessInput,
} from "./submitReadiness";

const conditions: SubmitReadinessConditions = {
  adjustmentPolicy: "quarterly",
  initialPaymentMode: "one_month",
  initialPaymentUsd: "",
  enrollmentEnabled: false,
  enrollmentFeeMode: null,
  enrollmentFeeUsd: "",
  depositEnabled: false,
  depositMode: "",
  depositUsd: "",
  emptyMonthsEnabled: false,
  emptyMonthChargePercent: "",
  earlyExitCostsText: "",
  earlyExitConditionsText: "",
};

const full: SubmitReadinessInput = {
  residenceId: "res-1",
  name: "Casa Norte",
  zone: "Palermo",
  addressLine: "Av. Siempreviva 123",
  tagline: "Tu lugar de casa",
  description: "Una descripción de más de veinte caracteres.",
  services: 2,
  commonAreas: 1,
  rulesSummary: "23 a 7 · Silencio",
  nearUniversities: 2,
  roomTypesCount: 1,
  roomTypesPriced: true,
  photos: 3,
  regulationPublished: true,
  rulesPdf: false,
  essentialFaqsReady: 3,
  conditions,
};

const keys = (r: ReturnType<typeof computeSubmitReadiness>) => r.missing.map((i) => i.key);

describe("computeSubmitReadiness", () => {
  it("con todo completo se puede enviar y no falta nada", () => {
    const r = computeSubmitReadiness(full);
    expect(r.canSubmit).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.items.map((i) => i.key)).toEqual(["basics", "services", "commonAreas", "rules", "regulation", "faq", "universities", "roomTypes", "photos", "conditions"]);
    expect(r.items.every((i) => i.ok && i.required && i.progress === 1 && i.hint === undefined)).toBe(true);
  });

  it("una residencia vacía no cumple ninguno de los requisitos base", () => {
    const r = computeSubmitReadiness({
      ...full,
      name: "",
      zone: "",
      addressLine: "",
      tagline: "",
      description: "",
      services: 0,
      commonAreas: 0,
      rulesSummary: "",
      nearUniversities: 0,
      roomTypesCount: 0,
      roomTypesPriced: false,
      photos: 0,
      regulationPublished: false,
      essentialFaqsReady: 0,
    });
    expect(r.canSubmit).toBe(false);
    expect(keys(r)).toEqual(["basics", "services", "commonAreas", "rules", "regulation", "faq", "universities", "roomTypes", "photos"]);
    expect(r.missing.every((i) => i.hint && i.href)).toBe(true);
  });

  it("datos básicos: la descripción necesita más de 20 caracteres y el hint nombra lo que falta", () => {
    const r = computeSubmitReadiness({ ...full, tagline: " ", description: "x".repeat(20) });
    expect(keys(r)).toEqual(["basics"]);
    expect(r.missing[0].hint).toBe("Completá el eslogan y la descripción (más de 20 caracteres).");
    expect(computeSubmitReadiness({ ...full, description: "x".repeat(21) }).canSubmit).toBe(true);
  });

  it("servicios y áreas comunes se piden por separado", () => {
    expect(keys(computeSubmitReadiness({ ...full, services: 0 }))).toEqual(["services"]);
    expect(keys(computeSubmitReadiness({ ...full, commonAreas: 0 }))).toEqual(["commonAreas"]);
  });

  it("reglamento: sin versión publicada no cumple; un PDF cargado sí; sin lectura disponible no se exige", () => {
    expect(keys(computeSubmitReadiness({ ...full, regulationPublished: false }))).toEqual(["regulation"]);
    expect(computeSubmitReadiness({ ...full, regulationPublished: false, rulesPdf: true }).canSubmit).toBe(true);
    const unavailable = computeSubmitReadiness({ ...full, regulationPublished: null });
    expect(unavailable.canSubmit).toBe(true);
    expect(unavailable.items.some((i) => i.key === "regulation")).toBe(false);
  });

  it("preguntas esenciales: hacen falta 3 listas; el hint dice cuántas faltan; sin catálogo no se exige", () => {
    const r = computeSubmitReadiness({ ...full, essentialFaqsReady: 2 });
    expect(keys(r)).toEqual(["faq"]);
    expect(r.missing[0].hint).toContain("1 pregunta esencial más");
    expect(r.missing[0].href).toBe("/residence/res-1/faq");
    expect(r.missing[0].progress).toBeCloseTo(2 / 3);
    expect(computeSubmitReadiness({ ...full, essentialFaqsReady: 6 }).canSubmit).toBe(true);
    expect(computeSubmitReadiness({ ...full, essentialFaqsReady: null }).items.some((i) => i.key === "faq")).toBe(false);
  });

  it("universidades: hacen falta 2", () => {
    const r = computeSubmitReadiness({ ...full, nearUniversities: 1 });
    expect(keys(r)).toEqual(["universities"]);
    expect(r.missing[0].hint).toContain("1 universidad más");
  });

  it("habitaciones: al menos 1 tipo y todos con tarifa", () => {
    expect(keys(computeSubmitReadiness({ ...full, roomTypesCount: 0, roomTypesPriced: true }))).toEqual(["roomTypes"]);
    const unpriced = computeSubmitReadiness({ ...full, roomTypesPriced: false });
    expect(unpriced.missing[0].hint).toContain("tarifa mayor a 0");
  });

  it("fotos: hacen falta 3 propias", () => {
    expect(keys(computeSubmitReadiness({ ...full, photos: 2 }))).toEqual(["photos"]);
    expect(computeSubmitReadiness({ ...full, photos: 2 }).missing[0].hint).toBe("Sumá 1 foto más (hacen falta 3).");
    expect(computeSubmitReadiness({ ...full, photos: 0 }).missing[0].hint).toContain("Cargá al menos 3 fotos");
    expect(computeSubmitReadiness({ ...full, photos: 12 }).canSubmit).toBe(true);
  });

  describe("condiciones de reserva", () => {
    const run = (patch: Partial<SubmitReadinessConditions>) => computeSubmitReadiness({ ...full, conditions: { ...conditions, ...patch } });

    it("pago inicial fijo sin monto, o solo-matrícula sin matrícula, no cumplen", () => {
      expect(keys(run({ initialPaymentMode: "custom_usd" }))).toEqual(["conditions"]);
      expect(run({ initialPaymentMode: "custom_usd", initialPaymentUsd: 400 }).canSubmit).toBe(true);
      expect(keys(run({ initialPaymentMode: "enrollment_only" }))).toEqual(["conditions"]);
      expect(run({ initialPaymentMode: "enrollment_only", enrollmentEnabled: true, enrollmentFeeMode: "one_month" }).canSubmit).toBe(true);
    });

    it("matrícula y depósito son excluyentes; la matrícula manual necesita monto", () => {
      expect(keys(run({ enrollmentEnabled: true, enrollmentFeeMode: "one_month", depositEnabled: true, depositUsd: 300 }))).toEqual(["conditions"]);
      expect(keys(run({ enrollmentEnabled: true, enrollmentFeeMode: "manual", enrollmentFeeUsd: "" }))).toEqual(["conditions"]);
      expect(run({ enrollmentEnabled: true, enrollmentFeeMode: "manual", enrollmentFeeUsd: 90 }).canSubmit).toBe(true);
    });

    it("mes vacío: si lo cobra, el porcentaje va de 1 a 100; si no lo cobra, no se pide", () => {
      expect(keys(run({ emptyMonthsEnabled: true, emptyMonthChargePercent: "" }))).toEqual(["conditions"]);
      expect(keys(run({ emptyMonthsEnabled: true, emptyMonthChargePercent: 0 }))).toEqual(["conditions"]);
      expect(keys(run({ emptyMonthsEnabled: true, emptyMonthChargePercent: 101 }))).toEqual(["conditions"]);
      expect(run({ emptyMonthsEnabled: true, emptyMonthChargePercent: 50 }).canSubmit).toBe(true);
      expect(run({ emptyMonthsEnabled: false }).canSubmit).toBe(true);
    });

    it("sin política de ajuste no cumple", () => {
      expect(keys(run({ adjustmentPolicy: "" }))).toEqual(["conditions"]);
    });

    it("promociones, mínimo de estadía y cláusulas del depósito no se piden (no hay campo en el chequeo)", () => {
      expect(run({}).canSubmit).toBe(true);
    });
  });

  describe("condicionales", () => {
    const run = (patch: Partial<SubmitReadinessConditions>) => computeSubmitReadiness({ ...full, conditions: { ...conditions, ...patch } });

    it("depósito: solo se exige monto si pidió depósito", () => {
      expect(run({}).items.some((i) => i.key === "deposit")).toBe(false);
      expect(keys(run({ depositEnabled: true }))).toEqual(["deposit"]);
      expect(run({ depositEnabled: true, depositUsd: 300 }).canSubmit).toBe(true);
      expect(run({ depositEnabled: true, depositMode: "one_month" }).canSubmit).toBe(true);
      expect(keys(run({ depositEnabled: true, depositUsd: 0 }))).toEqual(["deposit"]);
    });

    it("salida anticipada: si escribió algo, tiene que tener costos Y condiciones", () => {
      expect(run({}).items.some((i) => i.key === "earlyExit")).toBe(false);
      const onlyCosts = run({ earlyExitCostsText: "Pierde el depósito" });
      expect(keys(onlyCosts)).toEqual(["earlyExit"]);
      expect(onlyCosts.missing[0].hint).toContain("las condiciones");
      expect(keys(run({ earlyExitConditionsText: "Preaviso de 30 días" }))).toEqual(["earlyExit"]);
      expect(run({ earlyExitCostsText: "Pierde el depósito", earlyExitConditionsText: "Preaviso de 30 días" }).canSubmit).toBe(true);
    });

    it("las cláusulas del depósito solas no cuentan como elegir salida anticipada (no están en el chequeo)", () => {
      expect(run({ depositEnabled: true, depositUsd: 300 }).items.some((i) => i.key === "earlyExit")).toBe(false);
    });
  });
});

describe("submitBlockedMessage / readinessHeadline", () => {
  it("lista lo que falta en voseo y es vacío si no falta nada", () => {
    expect(submitBlockedMessage(computeSubmitReadiness(full))).toBe("");
    const msg = submitBlockedMessage(computeSubmitReadiness({ ...full, photos: 1, nearUniversities: 0 }));
    expect(msg).toContain("te faltan 2 requisitos");
    expect(msg).toContain("Al menos 2 universidades cercanas");
    expect(msg).toContain("Sumá 2 fotos más");
    expect(submitBlockedMessage(computeSubmitReadiness({ ...full, photos: 1 }))).toContain("te falta 1 requisito");
  });

  it("el titular distingue si puede enviar o no", () => {
    expect(readinessHeadline(computeSubmitReadiness(full), true)).toBe("Ya podés enviar para revisión.");
    expect(readinessHeadline(computeSubmitReadiness(full), false)).toBe("Cumplís todos los requisitos.");
    expect(readinessHeadline(computeSubmitReadiness({ ...full, photos: 0, services: 0 }), true)).toBe("Te faltan 2 requisitos para enviar.");
    expect(readinessHeadline(computeSubmitReadiness({ ...full, photos: 0 }), false)).toBe("Te falta 1 requisito.");
  });
});
