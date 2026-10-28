import { isTypeRequestable, startingPriceUsd, type TypeAvailabilityState } from "@/lib/availability/typeAvailability";
import { applyPromotion, pickActivePromotion, type PromotionRow } from "@/lib/applications/reservationMoney";

/**
 * «Antes/ahora» de la tarjeta de /search (DR18 t4, punto 5). Pura. Por cada tipo se aplica la promoción vigente (la de mayor %, sin apilar;
 * ver `pickActivePromotion`); el precio «desde» es el mínimo con promoción entre los tipos que admiten solicitud. Si el tipo ganador tiene
 * promoción se devuelve su precio de lista y el %; sin promoción (o sin la 0060), `fromUsd` es la tarifa de lista, como siempre.
 */
export type CardPriceInput = { id: string; listUsd: number; state: TypeAvailabilityState };

export function cardPriceFrom(
  types: readonly CardPriceInput[],
  promotions: readonly PromotionRow[],
  today: string,
): { fromUsd: number | null; listFromUsd: number | null; promotionPercent: number | null } {
  const priced = types.map((t) => {
    const promo = pickActivePromotion([...promotions], t.id, today);
    return { ...t, priceUsd: applyPromotion(t.listUsd, promo?.discountPercent), percent: promo ? promo.discountPercent : null };
  });
  const fromUsd = startingPriceUsd(priced.map((t) => ({ priceUsd: t.priceUsd, state: t.state })));
  if (fromUsd === null) return { fromUsd: null, listFromUsd: null, promotionPercent: null };
  // Ganador: el más barato entre los que admiten solicitud (o entre todos con precio válido si ninguno la admite), igual que `startingPriceUsd`.
  const valid = priced.filter((t) => Number.isFinite(t.priceUsd) && t.priceUsd > 0);
  const requestable = valid.filter((t) => isTypeRequestable(t.state));
  const pool = requestable.length > 0 ? requestable : valid;
  const winner = pool.reduce((best, t) => (t.priceUsd < best.priceUsd ? t : best), pool[0]);
  const hasPromo = winner.percent != null && winner.priceUsd < winner.listUsd;
  return { fromUsd, listFromUsd: hasPromo ? winner.listUsd : null, promotionPercent: hasPromo ? winner.percent : null };
}
