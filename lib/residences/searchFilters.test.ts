import { amenityKey, dedupeAmenities } from "@/lib/residences/amenityKeys";
import { toMapPoints } from "@/lib/residences/mapPoints";
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
  areaFilterOptions,
  serviceFilterOptions,
  priceHistogram,
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
    const { counts, promo } = buildCounts(list, f, { barrio: universe.barrios, uni: universe.unis, room: ["Doble"], services: ["Wifi"], areas: [], gender: [], status: ["real_by_place"] });
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

describe("género, vista y mapa", () => {
  const list = [
    full({ slug: "1", genderPolicy: "mixto", priceFromUsd: 200 }),
    full({ slug: "2", genderPolicy: "solo_mujeres", priceFromUsd: 300 }),
    full({ slug: "3", priceFromUsd: 500 }),
  ];
  const universe = buildUniverse(list);
  const parse = (p: Record<string, string>) => parseSearchFilters(p, universe);

  it("filtra por género; las que no lo declaran no coinciden con ninguno", () => {
    expect(applySearchFilters(list, parse({ genero: "solo_mujeres" })).map((r) => r.slug)).toEqual(["2"]);
    expect(applySearchFilters(list, parse({ genero: "mixto,solo_mujeres" })).map((r) => r.slug)).toEqual(["1", "2"]);
    expect(applySearchFilters(list, parse({ genero: "solo_hombres" }))).toHaveLength(0);
    expect(parse({ genero: "otro,mixto" }).gender).toEqual(["mixto"]);
    expect(countOption(list, parse({}), "gender", "mixto")).toBe(1);
    expect(countActiveFilters(parse({ genero: "mixto" }))).toBe(1);
  });

  it("una residencia con varios géneros coincide con cualquiera de ellos", () => {
    const multi = [full({ slug: "m", genderPolicy: "mixto", genderPolicies: ["mixto", "solo_mujeres"] }), full({ slug: "p", genderPolicy: "mixto", genderPolicies: ["mixto"] })];
    const u = buildUniverse(multi);
    expect(applySearchFilters(multi, parseSearchFilters({ genero: "solo_mujeres" }, u)).map((r) => r.slug)).toEqual(["m"]);
    expect(applySearchFilters(multi, parseSearchFilters({ genero: "mixto" }, u))).toHaveLength(2);
    expect(countOption(multi, parseSearchFilters({}, u), "gender", "solo_mujeres")).toBe(1);
  });

  it("parsea la vista (default grilla)", () => {
    expect(parse({}).view).toBe("grilla");
    expect(parse({ vista: "mapa" }).view).toBe("mapa");
    expect(parse({ vista: "lista" }).view).toBe("lista");
    expect(parse({ vista: "x" }).view).toBe("grilla");
  });

  it("histograma de precios con todos los filtros salvo el precio", () => {
    const h = priceHistogram(list, parse({ max: "250" }), { min: 200, max: 500 }, 3);
    expect(h).toEqual([1, 1, 1]);
    expect(priceHistogram(list, parse({ genero: "mixto" }), { min: 200, max: 500 }, 3)).toEqual([1, 0, 0]);
  });

  it("el mapa solo recibe lo necesario y cuenta las que no tienen ubicación", () => {
    const { points, withoutLocation } = toMapPoints([
      { slug: "a", name: "A", priceFromUsd: 100, latitude: -34.6, longitude: -58.4, zone: "Palermo" },
      { slug: "b", name: "B", priceFromUsd: 100, latitude: null, longitude: null, zone: "Almagro" },
      { slug: "c", name: "C", priceFromUsd: 100, zone: "Caballito" },
    ]);
    expect(points).toEqual([{ id: "a", slug: "a", name: "A", price: 100, lat: -34.6, lng: -58.4, zone: "Palermo" }]);
    expect(withoutLocation).toBe(2);
  });
});

describe("servicios y áreas sin opciones repetidas", () => {
  it("compara sin mayúsculas ni tildes y con equivalencias claras", () => {
    expect(amenityKey("  Área   de ESTUDIO ")).toBe(amenityKey("Sala de estudio"));
    expect(amenityKey("WiFi")).toBe(amenityKey("Wifi"));
    expect(amenityKey("WiFi de alta velocidad")).toBe(amenityKey("Wifi"));
    expect(amenityKey("Limpieza General")).not.toBe(amenityKey("Limpieza de Habitación"));
    expect(dedupeAmenities(["Wifi", "WiFi", "Cocina", "Cocina equipada"])).toEqual(["Wifi", "Cocina"]);
  });

  const catalog = [
    r("Palermo", ["Wifi", "WiFi de alta velocidad", "Cocina equipada", "Aire acondicionado", "Seguridad 24hs"], ["Cocina", "Gimnasio", "Sala de estudio", "Sala de cine"]),
    r("Almagro", ["WiFi", "aire acondicionado"], ["Sala de cine", "Aire Acondicionado"]),
  ];
  const custom = customAmenityOptions(catalog);

  it("los «Otro» ya cubiertos por una opción fija no se repiten y cada uno queda en un solo grupo", () => {
    expect(custom.services).toEqual(["Aire acondicionado", "Seguridad 24hs"]);
    // «Sala de cine» solo está en áreas; «Aire acondicionado» aparece más en servicios y se queda ahí.
    expect(custom.areas).toEqual(["Sala de cine"]);
  });

  it("las listas finales no tienen claves repetidas ni ítems en los dos grupos", () => {
    const services = serviceFilterOptions(custom.services);
    const areas = areaFilterOptions(custom.areas);
    const keys = (l: string[]) => l.map(amenityKey);
    expect(new Set(keys(services)).size).toBe(services.length);
    expect(new Set(keys(areas)).size).toBe(areas.length);
    expect(keys(services).filter((k) => keys(areas).includes(k))).toEqual([]);
    expect(areas).not.toContain("Área de Estudio");
    expect(areas).toContain("Sala de Estudio");
    expect(services).toContain("Cocina");
    expect(areas).not.toContain("Cocina");
    expect(parseAreaFilter("Cocina,Gimnasio,Patio")).toEqual(["Patio"]);
  });

  it("filtrar por «Cocina» encuentra la residencia aunque la haya cargado como área o como «Cocina equipada»", () => {
    const universe = buildUniverse(catalog);
    const f = parseSearchFilters({ servicios: "Cocina,wifi" }, universe);
    expect(f.services).toEqual(["Cocina", "Wifi"]);
    const rows = catalog.map((x) => ({ ...full({}), ...x }));
    expect(applySearchFilters(rows, f)).toHaveLength(1);
    expect(parseSearchFilters({ areas: "Cocina,Sala de estudio" }, universe).areas).toEqual(["Sala de Estudio"]);
  });
});
