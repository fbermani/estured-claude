import { describe, expect, it } from "vitest";
import { summarizeProfileEdit } from "./profileEditSummary";

describe("summarizeProfileEdit", () => {
  it("mínimo de estadía: null o 0 se lee «Sin mínimo»", () => {
    expect(summarizeProfileEdit("minimum_stay_months", { months: null }, { months: 6 })).toEqual({
      before: "Sin mínimo",
      after: "6 meses",
    });
  });
  it("servicios: lista vacía se muestra con guion", () => {
    expect(summarizeProfileEdit("services", { items: [] }, { items: ["Wifi", "Lavadero"] })).toEqual({
      before: "—",
      after: "Wifi, Lavadero",
    });
  });
  it("fotos: pluraliza y no rompe sin datos", () => {
    expect(summarizeProfileEdit("photos", null, { fileIds: ["a"] })?.after).toBe("1 foto nueva en revisión");
    expect(summarizeProfileEdit("photos", null, null)?.after).toBe("0 fotos nuevas en revisión");
  });
  it("grupo desconocido devuelve null", () => {
    expect(summarizeProfileEdit("otro", {}, {})).toBeNull();
  });
});
