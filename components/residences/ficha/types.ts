import type { TypeAvailabilityState } from "@/lib/availability/typeAvailability";

/** Tipo de habitación ya preparado para mostrar en la ficha (serializable: viaja de servidor a cliente). */
export type FichaRoomType = {
  id: string;
  name: string;
  priceUsd: number;
  /** ARS redondeados (`usdToArsRounded`), solo para mostrar, siempre con `ExchangeRateNote`. */
  arsRounded: number;
  /** "2 personas por habitación · mixta · baño compartido" (solo lo cargado). */
  subtitle: string;
  state: TypeAvailabilityState;
};
