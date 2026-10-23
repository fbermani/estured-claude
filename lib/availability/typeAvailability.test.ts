import { describe, expect, it } from "vitest";
import {
  canOfferBedSelection,
  isTypeRequestable,
  requestBlockedMessage,
  residenceAvailabilityMode,
  startingPriceUsd,
  typeAvailabilityMode,
  typeAvailabilityState,
} from "@/lib/availability/typeAvailability";
import { availabilityHelpText, availabilityLabel } from "@/components/ui/StatusTag";

describe("typeAvailabilityState", () => {
  it("normaliza los estados crudos de profile_availability", () => {
    expect(typeAvailabilityState("available_to_confirm")).toBe("available");
    expect(typeAvailabilityState("full")).toBe("full");
    expect(typeAvailabilityState("not_updated")).toBe("not_updated");
    expect(typeAvailabilityState("paused_by_residence")).toBe("paused_by_residence");
    expect(typeAvailabilityState("paused_by_admin")).toBe("paused_by_admin");
    expect(typeAvailabilityState(null)).toBe("not_updated");
    expect(typeAvailabilityState(undefined)).toBe("not_updated");
  });
});

describe("isTypeRequestable / canOfferBedSelection", () => {
  it("un tipo completo o pausado bloquea la solicitud; sin actualizar la permite", () => {
    expect(isTypeRequestable("available")).toBe(true);
    expect(isTypeRequestable("not_updated")).toBe(true);
    expect(isTypeRequestable("full")).toBe(false);
    expect(isTypeRequestable("paused_by_residence")).toBe(false);
    expect(isTypeRequestable("paused_by_admin")).toBe(false);
  });

  it("requestBlockedMessage distingue completo y pausas, y es null si se puede solicitar", () => {
    expect(requestBlockedMessage("available")).toBeNull();
    expect(requestBlockedMessage("not_updated")).toBeNull();
    expect(requestBlockedMessage("full")).toContain("no tiene lugar");
    expect(requestBlockedMessage("paused_by_residence")).toContain("pausó");
    expect(requestBlockedMessage("paused_by_admin")).toContain("EstuRed");
  });

  it("un tipo pausado nunca ofrece elegir cama", () => {
    expect(canOfferBedSelection("paused_by_residence")).toBe(false);
    expect(canOfferBedSelection("paused_by_admin")).toBe(false);
  });

  it("solo ofrece elegir una cama si el tipo está disponible", () => {
    expect(canOfferBedSelection("available")).toBe(true);
    expect(canOfferBedSelection("full")).toBe(false);
    expect(canOfferBedSelection("not_updated")).toBe(false);
    expect(canOfferBedSelection(null)).toBe(false);
    expect(canOfferBedSelection(undefined)).toBe(false);
  });
});

describe("residenceAvailabilityMode", () => {
  it("algún tipo disponible -> disponibilidad informada", () => {
    expect(residenceAvailabilityMode(["full", "available", "not_updated"])).toBe("by_room_type_to_confirm");
  });
  it("todos completos -> completa", () => {
    expect(residenceAvailabilityMode(["full", "full"])).toBe("full");
  });
  it("mezcla de completos y sin actualizar -> sin disponibilidad actualizada", () => {
    expect(residenceAvailabilityMode(["full", "not_updated"])).toBe("not_updated");
  });
  it("tipos pausados no cuentan como disponibles ni como completos", () => {
    expect(residenceAvailabilityMode(["paused_by_residence", "full"])).toBe("not_updated");
    expect(residenceAvailabilityMode(["paused_by_admin", "available"])).toBe("by_room_type_to_confirm");
  });
  it("sin tipos -> sin disponibilidad actualizada", () => {
    expect(residenceAvailabilityMode([])).toBe("not_updated");
  });
});

describe("typeAvailabilityMode", () => {
  it("mapea al modo de StatusTag", () => {
    expect(typeAvailabilityMode("available")).toBe("by_room_type_to_confirm");
    expect(typeAvailabilityMode("full")).toBe("full");
    expect(typeAvailabilityMode("not_updated")).toBe("not_updated");
    expect(typeAvailabilityMode("paused_by_residence")).toBe("paused_by_residence");
    expect(typeAvailabilityMode("paused_by_admin")).toBe("paused_by_admin");
  });
});

describe("startingPriceUsd", () => {
  it("toma el mínimo de los tipos no completos", () => {
    expect(
      startingPriceUsd([
        { priceUsd: 160, state: "full" },
        { priceUsd: 220, state: "available" },
        { priceUsd: 190, state: "not_updated" },
      ]),
    ).toBe(190);
  });
  it("si todos están completos, el mínimo de todos", () => {
    expect(
      startingPriceUsd([
        { priceUsd: 160, state: "full" },
        { priceUsd: 220, state: "full" },
      ]),
    ).toBe(160);
  });
  it("no toma de base un tipo pausado si hay otro que admite solicitud", () => {
    expect(
      startingPriceUsd([
        { priceUsd: 120, state: "paused_by_residence" },
        { priceUsd: 200, state: "available" },
      ]),
    ).toBe(200);
  });
  it("nunca devuelve 0 ('Desde USD 0'): ignora precios 0, negativos y no finitos", () => {
    expect(
      startingPriceUsd([
        { priceUsd: 0, state: "available" },
        { priceUsd: -5, state: "available" },
        { priceUsd: 210, state: "available" },
      ]),
    ).toBe(210);
    expect(startingPriceUsd([{ priceUsd: 0, state: "available" }])).toBeNull();
  });
  it("ignora precios inválidos y devuelve null sin precios", () => {
    expect(startingPriceUsd([{ priceUsd: Number.NaN, state: "available" }, { priceUsd: 0, state: "available" }])).toBeNull();
    expect(startingPriceUsd([])).toBeNull();
  });
});

describe("StatusTag: variante 'completa' por tipo", () => {
  it("full con tipo -> '<Tipo>: completa'", () => {
    expect(availabilityLabel("full", "Doble")).toBe("Doble: completa");
    expect(availabilityHelpText("full", "Doble")).toContain("No hay lugar informado en este tipo");
  });
  it("full sin tipo conserva 'Residencia completa'", () => {
    expect(availabilityLabel("full")).toBe("Residencia completa");
    expect(availabilityHelpText("full")).toContain("Residencia completa");
  });
  it("pausas: copy de docs/04 §10.2", () => {
    expect(availabilityLabel("paused_by_residence", "Doble")).toBe("Solicitudes pausadas por la residencia");
    expect(availabilityLabel("paused_by_admin", "Doble")).toBe("Disponibilidad pausada por EstuRed");
    expect(availabilityHelpText("paused_by_residence")).toBe("Solicitudes pausadas por la residencia.");
    expect(availabilityHelpText("paused_by_admin")).toBe("Disponibilidad pausada por EstuRed.");
  });
  it("los demás estados ignoran el nombre del tipo", () => {
    expect(availabilityLabel("by_room_type_to_confirm", "Doble")).toBe("Disponibilidad informada");
    expect(availabilityLabel("not_updated", "Doble")).toBe("Sin disponibilidad actualizada");
  });
});
