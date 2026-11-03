import { describe, expect, it } from "vitest";
import { amenityDetailsFromForm, amenityDisplayName, normalizeAmenityLists, parseAmenityDetails } from "@/lib/residences/amenityDetails";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("amenityDetails", () => {
  it("parsea el jsonb guardado y descarta lo inválido", () => {
    expect(parseAmenityDetails({ kitchens: 2, cleaning_general: { mode: "weekly", per_week: 3 } })).toEqual({ kitchens: 2, cleaningGeneral: { mode: "weekly", perWeek: 3 } });
    expect(parseAmenityDetails({ kitchens: 9, cleaning_general: { mode: "weekly", per_week: 7 } })).toEqual({});
    expect(parseAmenityDetails(null)).toEqual({});
  });

  it("valida el formulario: solo para ítems tildados y dentro de rango", () => {
    const sel = { services: ["Limpieza General"], commonAreas: ["Cocina compartida"] };
    expect(amenityDetailsFromForm(form({ amenity_kitchens: "3", amenity_cleaning_mode: "weekly", amenity_cleaning_per_week: "4" }), sel).value).toEqual({ kitchens: 3, cleaning_general: { mode: "weekly", per_week: 4 } });
    expect(amenityDetailsFromForm(form({ amenity_kitchens: "1", amenity_cleaning_mode: "daily" }), sel).value).toEqual({ kitchens: 1, cleaning_general: { mode: "daily" } });
    expect(amenityDetailsFromForm(form({ amenity_kitchens: "6", amenity_cleaning_mode: "daily" }), sel).error).toBeTruthy();
    expect(amenityDetailsFromForm(form({ amenity_kitchens: "2", amenity_cleaning_mode: "weekly", amenity_cleaning_per_week: "0" }), sel).error).toBeTruthy();
    expect(amenityDetailsFromForm(form({ amenity_kitchens: "5" }), { services: [], commonAreas: [] }).value).toEqual({});
  });

  it("arma el texto visible", () => {
    expect(amenityDisplayName("Limpieza General", { cleaningGeneral: { mode: "weekly", perWeek: 3 } })).toBe("Limpieza General · 3 veces por semana");
    expect(amenityDisplayName("Limpieza General", { cleaningGeneral: { mode: "daily" } })).toBe("Limpieza General · Todos los días");
    expect(amenityDisplayName("Cocina compartida", { kitchens: 2 })).toBe("Cocina compartida · 2 cocinas");
    expect(amenityDisplayName("Gimnasio")).toBe("Gimnasio / Área para ejercitar");
  });

  it("normaliza filas anteriores a la migración", () => {
    expect(normalizeAmenityLists({ services: ["Wifi", "Gimnasio", "Cocina"], commonAreas: ["Patio", "Gimnasio"] })).toEqual({
      services: ["Wifi"],
      commonAreas: ["Patio", "Gimnasio", "Cocina compartida"],
    });
  });
});
