import { describe, expect, it } from "vitest";
import { parseCustomAmenityDrafts, planCustomAmenities, validateCustomAmenityLabel } from "@/lib/residences/customAmenities";

describe("validateCustomAmenityLabel", () => {
  it("acepta un texto corto y lo normaliza", () => {
    expect(validateCustomAmenityLabel("  Bicicletero   cubierto ", "service")).toEqual({ ok: true, value: "Bicicletero cubierto" });
  });
  it.each([
    ["ab", "muy corto"],
    ["x".repeat(41), "muy largo"],
    ["Escribinos a hola@mail.com", "email"],
    ["Visitá www.residencia.com", "enlace"],
    ["Consultas al 11 5555 1234", "teléfono"],
    ["Pedí por WhatsApp", "contacto"],
    ["Seguridad garantizada", "palabra prohibida"],
    ["Cocina <b>", "símbolos"],
  ])("rechaza %s (%s)", (text) => {
    expect(validateCustomAmenityLabel(text, "service").ok).toBe(false);
  });
  it("rechaza duplicar una opción fija (sin tildes ni mayúsculas)", () => {
    expect(validateCustomAmenityLabel("lavanderia", "service").ok).toBe(false);
    expect(validateCustomAmenityLabel("terraza", "area").ok).toBe(false);
    expect(validateCustomAmenityLabel("terraza", "service").ok).toBe(true);
  });
});

describe("planCustomAmenities", () => {
  const existing = [{ id: "11111111-1111-1111-1111-111111111111", kind: "service" as const, label: "Bicicletero", status: "approved" as const }];
  it("conserva el ítem sin cambios y crea el nuevo como pendiente", () => {
    const r = planCustomAmenities(existing, [
      { id: existing[0].id, kind: "service", label: "Bicicletero" },
      { kind: "area", label: "Huerta" },
    ]);
    expect(r).toEqual({ ok: true, plan: { toCreate: [{ kind: "area", label: "Huerta" }], toDeleteIds: [] } });
  });
  it("un texto cambiado se borra y se recrea; lo que falta se borra", () => {
    const r = planCustomAmenities(existing, [{ id: existing[0].id, kind: "service", label: "Bicicletero techado" }]);
    expect(r).toEqual({ ok: true, plan: { toCreate: [{ kind: "service", label: "Bicicletero techado" }], toDeleteIds: [existing[0].id] } });
    expect(planCustomAmenities(existing, [])).toEqual({ ok: true, plan: { toCreate: [], toDeleteIds: [existing[0].id] } });
  });
  it("respeta el tope de pendientes y rechaza repetidos", () => {
    const many = ["Huerta", "Taller", "Biblioteca", "Cine", "Estudio", "Jardín"].map((label) => ({ kind: "area" as const, label }));
    expect(planCustomAmenities([], many).ok).toBe(false);
    expect(planCustomAmenities([], [{ kind: "area", label: "Huerta" }, { kind: "area", label: "huerta" }]).ok).toBe(false);
  });
  it("parsea el JSON y rechaza formatos inválidos", () => {
    expect(parseCustomAmenityDrafts('[{"kind":"area","label":"Huerta"}]')).toEqual([{ id: undefined, kind: "area", label: "Huerta" }]);
    expect(parseCustomAmenityDrafts('[{"kind":"otro","label":"x"}]')).toBeNull();
    expect(parseCustomAmenityDrafts("no json")).toBeNull();
  });
});
