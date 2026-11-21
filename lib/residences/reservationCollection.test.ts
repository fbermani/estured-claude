import { describe, expect, it } from "vitest";
import {
  effectiveReservationModes,
  evaluateCollectionRequirement,
  explicitReservationModes,
  methodDataState,
  normalizeReservationModes,
} from "./reservationCollection";

describe("normalizeReservationModes", () => {
  it("acepta una o ambas opciones y devuelve el orden canónico", () => {
    expect(normalizeReservationModes(["whatsapp_direct"])).toEqual({ ok: true, value: ["whatsapp_direct"] });
    expect(normalizeReservationModes(["whatsapp_direct", "enabled_methods"])).toEqual({ ok: true, value: ["enabled_methods", "whatsapp_direct"] });
  });
  it("rechaza vacío, desconocidas, repetidas y no-listas", () => {
    expect(normalizeReservationModes([]).ok).toBe(false);
    expect(normalizeReservationModes(["otra"]).ok).toBe(false);
    expect(normalizeReservationModes(["enabled_methods", "enabled_methods"]).ok).toBe(false);
    expect(normalizeReservationModes("enabled_methods").ok).toBe(false);
  });
});

describe("effectiveReservationModes (DR63 (k))", () => {
  it("sin configurar (null, undefined o vacío) equivale a contacto directo", () => {
    expect(effectiveReservationModes(null)).toEqual(["whatsapp_direct"]);
    expect(effectiveReservationModes(undefined)).toEqual(["whatsapp_direct"]);
    expect(effectiveReservationModes([])).toEqual(["whatsapp_direct"]);
    expect(effectiveReservationModes(["basura"])).toEqual(["whatsapp_direct"]);
  });
  it("con configuración respeta lo elegido", () => {
    expect(effectiveReservationModes(["enabled_methods"])).toEqual(["enabled_methods"]);
    expect(effectiveReservationModes(["whatsapp_direct", "enabled_methods"])).toEqual(["enabled_methods", "whatsapp_direct"]);
  });
  it("las opciones explícitas NO aplican el valor por defecto", () => {
    expect(explicitReservationModes(null)).toEqual([]);
    expect(explicitReservationModes([])).toEqual([]);
    expect(explicitReservationModes(["enabled_methods"])).toEqual(["enabled_methods"]);
  });
});

describe("methodDataState", () => {
  it("distingue sin datos, pendiente y aprobado", () => {
    expect(methodDataState(null)).toBe("none");
    expect(methodDataState({ details: null, pendingDetails: null })).toBe("none");
    expect(methodDataState({ details: "alias", pendingDetails: null })).toBe("approved");
    expect(methodDataState({ details: null, pendingDetails: "alias" })).toBe("pending");
  });
  it("con datos aprobados y un cambio pendiente figura pendiente", () => {
    expect(methodDataState({ details: "viejo", pendingDetails: "nuevo" })).toBe("pending");
  });
  it("un nombre pendiente de «Otro» también es pendiente", () => {
    expect(methodDataState({ details: "viejo", pendingDetails: null, pendingMethodLabel: "Cuenta DNI" })).toBe("pending");
  });
});

describe("evaluateCollectionRequirement (requisito 10 de DR59)", () => {
  it("sin configurar NO cumple, aunque en el flujo equivalga a contacto directo", () => {
    for (const modes of [null, []] as const) {
      const r = evaluateCollectionRequirement({ modes, acceptedMethods: null, methodsWithData: [] });
      expect(r.ok).toBe(false);
      expect(r.hint).toContain("Elegí cómo cobrás la reserva");
    }
  });
  it("contacto directo alcanza, sin ningún dato extra", () => {
    expect(evaluateCollectionRequirement({ modes: ["whatsapp_direct"], acceptedMethods: [], methodsWithData: [] })).toEqual({ ok: true, progress: 1 });
  });
  it("medios habilitados sin ningún medio no cumple", () => {
    const r = evaluateCollectionRequirement({ modes: ["enabled_methods"], acceptedMethods: [], methodsWithData: [] });
    expect(r.ok).toBe(false);
    expect(r.hint).toContain("al menos un medio");
  });
  it("medios habilitados exige datos de CADA medio aceptado y los nombra", () => {
    const r = evaluateCollectionRequirement({ modes: ["enabled_methods"], acceptedMethods: ["mercadopago", "belo", "other"], methodsWithData: ["mercadopago"] });
    expect(r.ok).toBe(false);
    expect(r.hint).toBe("Cargá los datos de cobro de Belo y Otro.");
    expect(r.progress).toBeGreaterThan(0.3);
    expect(r.progress).toBeLessThan(1);
  });
  it("medios habilitados con todos los datos cargados cumple", () => {
    expect(evaluateCollectionRequirement({ modes: ["enabled_methods"], acceptedMethods: ["mercadopago", "belo"], methodsWithData: ["belo", "mercadopago", "uala"] }).ok).toBe(true);
  });
  it("con ambas opciones basta contacto directo", () => {
    expect(evaluateCollectionRequirement({ modes: ["enabled_methods", "whatsapp_direct"], acceptedMethods: ["belo"], methodsWithData: [] }).ok).toBe(true);
  });
  it("ignora claves que no son del catálogo", () => {
    const r = evaluateCollectionRequirement({ modes: ["enabled_methods"], acceptedMethods: ["bitcoin"], methodsWithData: [] });
    expect(r.ok).toBe(false);
    expect(r.hint).toContain("al menos un medio");
  });
});
