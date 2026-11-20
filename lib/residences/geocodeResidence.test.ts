import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
import { geocodeResidenceByAdmin } from "./geocodeResidence";

function fakeAdmin(row: Record<string, unknown> | null) {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      update,
    }),
  };
  return { admin: admin as never, update };
}
const actor = { residenceId: "r1", actorUserId: "u1", actorRole: "admin" };

describe("geocodeResidenceByAdmin", () => {
  it("geocodifica la dirección y guarda la coordenada", async () => {
    const { admin, update } = fakeAdmin({ id: "r1", address_line: "Av. Santa Fe 3000", public_area: "Palermo", city: "CABA", latitude: null, longitude: null });
    const geocoder = vi.fn().mockResolvedValue({ lat: -34.5845, lng: -58.4233 });
    expect(await geocodeResidenceByAdmin(admin, actor, geocoder)).toEqual({ status: "ok", lat: -34.5845, lng: -58.4233 });
    expect(geocoder).toHaveBeenCalledWith({ addressLine: "Av. Santa Fe 3000", zone: "Palermo", city: "CABA" });
    expect(update).toHaveBeenCalledWith({ latitude: -34.5845, longitude: -58.4233 });
  });

  it("si el geocoder no encuentra, no toca la coordenada", async () => {
    const { admin, update } = fakeAdmin({ id: "r1", address_line: "Calle inventada 1", public_area: "Palermo", city: "CABA" });
    expect(await geocodeResidenceByAdmin(admin, actor, vi.fn().mockResolvedValue(null))).toEqual({ status: "not_found" });
    expect(update).not.toHaveBeenCalled();
  });

  it("falla con mensaje si no hay dirección o residencia", async () => {
    const geocoder = vi.fn();
    expect((await geocodeResidenceByAdmin(fakeAdmin({ id: "r1", address_line: " " }).admin, actor, geocoder)).status).toBe("error");
    expect((await geocodeResidenceByAdmin(fakeAdmin(null).admin, actor, geocoder)).status).toBe("error");
    expect(geocoder).not.toHaveBeenCalled();
  });
});
