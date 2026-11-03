import { describe, expect, it } from "vitest";
import {
  MAX_BULK_ROOMS,
  ROOM_OUT_OF_SERVICE_DEFAULT_REASON,
  canMarkRoomOutOfService,
  planBulkGenderChange,
  roomOutOfServiceReason,
} from "@/lib/residences/roomBulk";

const room = (id: string, capacityPerRoom: number) => ({ id, label: `Hab ${id}`, capacityPerRoom });

describe("edición en lote del género", () => {
  it("aplica el mismo género a todas las elegidas", () => {
    expect(planBulkGenderChange([room("1", 2), room("2", 3)], "femenino")).toEqual({ ok: true, gender: "femenino", roomIds: ["1", "2"] });
  });

  it("en habitaciones individuales admite «sin especificar»", () => {
    expect(planBulkGenderChange([room("1", 1)], "sin_especificar")).toMatchObject({ ok: true, gender: "sin_especificar" });
  });

  it("si alguna es compartida, rechaza «sin especificar» y no cambia ninguna", () => {
    const r = planBulkGenderChange([room("1", 1), room("2", 2)], "sin_especificar");
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Hab 2") });
  });

  it("rechaza géneros inválidos, listas vacías y lotes demasiado grandes", () => {
    expect(planBulkGenderChange([room("1", 2)], "otro").ok).toBe(false);
    expect(planBulkGenderChange([], "mixto")).toMatchObject({ ok: false, error: "Elegí al menos una habitación." });
    const many = Array.from({ length: MAX_BULK_ROOMS + 1 }, (_, i) => room(String(i), 2));
    expect(planBulkGenderChange(many, "mixto").ok).toBe(false);
  });
});

describe("habitación fuera de servicio", () => {
  it("solo sin residentes asignados y con camas cargadas", () => {
    expect(canMarkRoomOutOfService([{ occupied: false }, { occupied: false }])).toEqual({ ok: true });
    expect(canMarkRoomOutOfService([{ occupied: false }, { occupied: true }])).toMatchObject({ ok: false, error: expect.stringContaining("Reubicalos") });
    expect(canMarkRoomOutOfService([]).ok).toBe(false);
  });

  it("usa la razón escrita o la genérica, recortada", () => {
    expect(roomOutOfServiceReason("  Pintura  ")).toBe("Pintura");
    expect(roomOutOfServiceReason("")).toBe(ROOM_OUT_OF_SERVICE_DEFAULT_REASON);
    expect(roomOutOfServiceReason(null)).toBe(ROOM_OUT_OF_SERVICE_DEFAULT_REASON);
    expect(roomOutOfServiceReason("x".repeat(300))).toHaveLength(200);
  });
});
