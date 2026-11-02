import { describe, expect, it } from "vitest";
import type { AvailabilityMode } from "@/types/domain";
import { sortRecommended } from "@/lib/residences/searchFilters";

const x = (id: string, availabilityMode: AvailabilityMode) => ({ id, availabilityMode });

describe("sortRecommended (DR24)", () => {
  // Entrada = created_at desc (más reciente primero), como la entrega el catálogo.
  const input = [
    x("a-full", "full"),
    x("b-nu", "not_updated"),
    x("c-real", "real_by_place"),
    x("d-pause", "paused_by_admin"),
    x("e-inf", "by_room_type_to_confirm"),
    x("f-nu", "not_updated"),
    x("g-pr", "paused_by_residence"),
  ];

  it("ordena en 3 grupos y conserva el orden por fecha dentro de cada uno", () => {
    expect(sortRecommended(input).map((r) => r.id)).toEqual(["c-real", "e-inf", "b-nu", "f-nu", "a-full", "d-pause", "g-pr"]);
  });

  it("no oculta ninguna y no muta la entrada", () => {
    const copy = [...input];
    expect(sortRecommended(input)).toHaveLength(input.length);
    expect(input).toEqual(copy);
  });
});
