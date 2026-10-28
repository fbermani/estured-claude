import { describe, expect, it } from "vitest";
import { computeCapacity, formatOccupancy } from "./occupancy";

describe("occupancy", () => {
  it("capacidad = habitaciones × plazas por habitación", () => {
    const types = [{ id: "a", capacity_per_room: 2 }, { id: "b", capacity_per_room: 1 }, { id: "c", capacity_per_room: null }];
    const rooms = [{ room_type_id: "a" }, { room_type_id: "a" }, { room_type_id: "b" }, { room_type_id: "c" }, { room_type_id: "x" }];
    expect(computeCapacity(types, rooms)).toBe(2 * 2 + 1 + 1);
    expect(computeCapacity(types, [])).toBe(0);
  });
  it("texto sin porcentajes ni «quedan»", () => {
    expect(formatOccupancy(28, 24)).toBe("28 plazas · 24 residentes");
    expect(formatOccupancy(1, 1)).toBe("1 plaza · 1 residente");
    expect(formatOccupancy(26, null)).toBe("26 plazas");
    expect(formatOccupancy(26, 0)).toBe("26 plazas · 0 residentes");
    expect(formatOccupancy(0, 5)).toBeNull();
    expect(formatOccupancy(null, null)).toBeNull();
  });
});
