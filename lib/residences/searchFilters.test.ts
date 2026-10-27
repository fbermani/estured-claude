import { describe, expect, it } from "vitest";
import type { Residence } from "@/types/domain";
import { barriosWithResidences, filterByAmenities, parseAreaFilter, parseServiceFilter } from "@/lib/residences/searchFilters";

const r = (zone: string, services: string[], commonAreas: string[]) => ({ zone, services, commonAreas }) as unknown as Residence;

describe("searchFilters", () => {
  it("descarta valores que no están en las listas de la ficha", () => {
    expect(parseServiceFilter("Wifi,Hackeo,Cocina,Wifi")).toEqual(["Wifi", "Cocina"]);
    expect(parseAreaFilter(["Patio", "Mazmorra"])).toEqual(["Patio"]);
    expect(parseServiceFilter(undefined)).toEqual([]);
  });

  it("exige todos los servicios y áreas pedidos", () => {
    const list = [r("Palermo", ["Wifi", "Cocina"], ["Patio"]), r("Almagro", ["Wifi"], [])];
    expect(filterByAmenities(list, [], [])).toHaveLength(2);
    expect(filterByAmenities(list, ["Wifi"], [])).toHaveLength(2);
    expect(filterByAmenities(list, ["Wifi", "Cocina"], ["Patio"])).toHaveLength(1);
  });

  it("lista solo los barrios que tienen residencias", () => {
    expect(barriosWithResidences([{ zone: "Palermo" }, { zone: "Almagro" }, { zone: "Palermo" }, { zone: "CABA" }])).toEqual([
      "Almagro",
      "Palermo",
    ]);
  });
});
