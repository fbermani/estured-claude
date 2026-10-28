import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true, notifyAdmins: async () => undefined }));
vi.mock("@/lib/residences/notifyResidenceTeam", () => ({ notifyResidenceTeam: async () => undefined }));

import { createInMemorySupabase } from "@/lib/testing/inMemorySupabase";
import { getApprovedCustomAmenitiesByResidence } from "@/lib/residences/customAmenitiesDb";
import { loadPromotionsByResidence } from "@/lib/residences/promotions";

describe("getApprovedCustomAmenitiesByResidence", () => {
  const rows = [
    { id: "1", residence_id: "a", kind: "service", label: "Lavandería", status: "approved" },
    { id: "2", residence_id: "a", kind: "area", label: "Sala de cine", status: "approved" },
    { id: "3", residence_id: "a", kind: "service", label: "Pendiente", status: "pending" },
    { id: "4", residence_id: "b", kind: "service", label: "Rechazado", status: "rejected" },
  ];
  it("solo aprobados, agrupados por residencia", async () => {
    const { client } = createInMemorySupabase({ residence_custom_amenities: rows });
    const map = await getApprovedCustomAmenitiesByResidence(client as never, ["a", "b"]);
    expect(map.get("a")).toEqual({ services: ["Lavandería"], areas: ["Sala de cine"] });
    expect(map.has("b")).toBe(false);
  });
  it("sin la migración devuelve vacío", async () => {
    const { client } = createInMemorySupabase({}, { missingTables: ["residence_custom_amenities"] });
    expect((await getApprovedCustomAmenitiesByResidence(client as never, ["a"])).size).toBe(0);
  });
});

describe("loadPromotionsByResidence", () => {
  const promo = (over: object) => ({ id: "p", residence_id: "a", label: "Promo", discount_percent: 20, room_type_id: null, starts_on: "2026-10-01", ends_on: null, is_active: true, ...over });
  it("agrupa las activas por residencia", async () => {
    const { client } = createInMemorySupabase({ residence_promotions: [promo({}), promo({ id: "q", is_active: false }), promo({ id: "r", residence_id: "b" })] });
    const map = await loadPromotionsByResidence(client as never, ["a", "b"]);
    expect(map.get("a")).toHaveLength(1);
    expect(map.get("a")?.[0]).toMatchObject({ discountPercent: 20, isActive: true });
    expect(map.get("b")).toHaveLength(1);
  });
  it("sin la 0060 devuelve vacío", async () => {
    const { client } = createInMemorySupabase({}, { missingTables: ["residence_promotions"] });
    expect((await loadPromotionsByResidence(client as never, ["a"])).size).toBe(0);
  });
});
