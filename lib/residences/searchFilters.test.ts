import { describe, expect, it } from "vitest";
import type { Residence } from "@/types/domain";
import {
  applySearchFilters,
  barriosWithResidences,
  buildCounts,
  buildUniverse,
  countActiveFilters,
  countOption,
  customAmenityOptions,
  parseAreaFilter,
  parseSearchFilters,
  parseServiceFilter,
  priceBounds,
} from "@/lib/residences/searchFilters";

const r = (zone: string, services: string[], commonAreas: string[]) => ({ zone, services, commonAreas }) as unknown as Residence;

describe("searchFilters", () => {
  it("descarta valores que no están en las listas de la ficha", () => {
    expect(parseServiceFilter("Wifi,Hackeo,Cocina,Wifi")).toEqual(["Wifi", "Cocina"]);
    expect(parseAreaFilter(["Patio", "Mazmorra"])).toEqual(["Patio"]);
    expect(parseServiceFilter(undefined)).toEqual([]);
  });

  it("lista solo los barrios que tienen residencias", () => {
    expect(barriosWithResidences([{ zone: "Palermo" }, { zone: "Almagro" }, { zone: "Palermo" }, { zone: "CABA" }])).toEqual([
      "Almagro",
      "Palermo",
    ]);
  });

  it("los ítems «Otro» aprobados del catálogo se pueden filtrar; lo demás se descarta", () => {
    const list = [r("Palermo", ["Wifi", "Pileta climatizada"], ["Patio", "Sala de cine"])];
    const custom = customAmenityOptions(list);
    expect(custom).toEqual({ services: ["Pileta climatizada"], areas: ["Sala de cine"] });
    expect(parseServiceFilter("Wifi,Pileta climatizada,Otro cosa", custom.services)).toEqual(["Wifi", "Pileta climatizada"]);
    expect(parseAreaFilter("Sala de cine", [])).toEqual([]);
  });
});

const full = (o: Partial<Residence>) =>
  ({ zone: "Palermo", nearUniversities: [], roomTypes: [], services: [], commonAreas: [], availabilityMode: "by_room_type_to_confirm", priceFromUsd: 300, ...o }) as unknown as Residence;

describe("filtros estilo Booking", () => {
  const list = [
    full({ zone: "Palermo", nearUniversities: ["UBA"], roomTypes: [{ type: "Individual", priceUsd: 300, available: true }], priceFromUsd: 300, promotionPercent: 10, acceptsMinors: true }),
    full({ zone: "Almagro", nearUniversities: ["UBA", "UTN"], roomTypes: [{ type: "Doble", priceUsd: 200, available: true }], priceFromUsd: 200, availabilityMode: "real_by_place" }),
    full({ zone: "Almagro", nearUniversities: ["UTN"], roomTypes: [{ type: "Doble", priceUsd: 450, available: false }], priceFromUsd: 450, services: ["Wifi"] }),
  ];
  const universe = buildUniverse(list);
  const parse = (p: Record<string, string>) => parseSearchFilters(p, universe);

  it("parsea y valida los query params", () => {
    const f = parse({ barrio: "Almagro,Marte", hab: "Doble,Cama", uni: "UBA", estado: "real_by_place,x", promo: "1", min: "500", max: "100", orden: "pd" });
    expect(f.barrio).toEqual(["Almagro"]);
    expect(f.room).toEqual(["Doble"]);
    expect(f.status).toEqual(["real_by_place"]);
    expect(f.promo).toBe(true);
    expect(f.minor).toBe(false);
    expect([f.pmin, f.pmax]).toEqual([100, 500]);
    expect(f.sort).toBe("pd");
    expect(parse({ orden: "hack", min: "-3" })).toMatchObject({ sort: "rec", pmin: null });
  });

  it("aplica filtros y orden", () => {
    expect(applySearchFilters(list, parse({ barrio: "Almagro" }))).toHaveLength(2);
    expect(applySearchFilters(list, parse({ max: "250" }))).toHaveLength(1);
    expect(applySearchFilters(list, parse({ promo: "1" }))).toHaveLength(1);
    expect(applySearchFilters(list, parse({ menores: "1" }))).toHaveLength(1);
    expect(applySearchFilters(list, parse({ orden: "pa" })).map((r) => r.priceFromUsd)).toEqual([200, 300, 450]);
  });

  it("los contadores respetan los demás filtros y no el propio grupo", () => {
    const f = parse({ barrio: "Almagro" });
    expect(countOption(list, f, "uni", "UBA")).toBe(1);
    expect(countOption(list, f, "barrio", "Palermo")).toBe(1);
    const { counts, promo } = buildCounts(list, f, { barrio: universe.barrios, uni: universe.unis, room: ["Doble"], services: ["Wifi"], areas: [], status: ["real_by_place"] });
    expect(counts.room.Doble).toBe(2);
    expect(counts.services.Wifi).toBe(1);
    // «todos»: con Wifi elegido, sumar Cocina deja 0 (nadie ofrece ambos)
    expect(countOption(list, parse({ servicios: "Wifi" }), "services", "Cocina")).toBe(0);
    expect(promo).toBe(0);
  });

  it("límites de precio y cantidad de filtros activos", () => {
    expect(priceBounds(list)).toEqual({ min: 200, max: 450 });
    expect(priceBounds([])).toEqual({ min: 0, max: 0 });
    expect(countActiveFilters(parse({ barrio: "Almagro", promo: "1", min: "100" }))).toBe(3);
  });
});
