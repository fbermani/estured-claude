import { describe, expect, it } from "vitest";
import { cardPriceFrom } from "@/lib/residences/cardPromotion";
import type { PromotionRow } from "@/lib/applications/reservationMoney";

const promo = (over: Partial<PromotionRow>): PromotionRow => ({
  id: "p1", label: "Promo", discountPercent: 20, roomTypeId: null, startsOn: "2026-10-01", endsOn: null, isActive: true, ...over,
});
const types = [
  { id: "a", listUsd: 400, state: "available" as const },
  { id: "b", listUsd: 300, state: "full" as const },
];

describe("cardPriceFrom", () => {
  it("sin promociones queda la tarifa de lista", () => {
    expect(cardPriceFrom(types, [], "2026-10-28")).toEqual({ fromUsd: 400, listFromUsd: null, promotionPercent: null });
  });
  it("con promoción vigente muestra antes/ahora", () => {
    expect(cardPriceFrom(types, [promo({})], "2026-10-28")).toEqual({ fromUsd: 320, listFromUsd: 400, promotionPercent: 20 });
  });
  it("ignora promociones vencidas, inactivas o de otro tipo", () => {
    expect(cardPriceFrom(types, [promo({ endsOn: "2026-10-01" }), promo({ isActive: false }), promo({ roomTypeId: "z" })], "2026-10-28").listFromUsd).toBeNull();
  });
  it("sin precios válidos devuelve null", () => {
    expect(cardPriceFrom([{ id: "a", listUsd: 0, state: "available" }], [], "2026-10-28").fromUsd).toBeNull();
  });
});
