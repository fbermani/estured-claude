import type { TypeAvailabilityState } from "@/lib/availability/typeAvailability";

/** Tipo de habitación ya preparado para mostrar en la ficha (serializable: viaja de servidor a cliente). */
export type FichaRoomType = {
  id: string;
  name: string;
  /** Lo que paga el estudiante por mes: con la promoción vigente aplicada, si hay (DR18 t3). */
  priceUsd: number;
  /** Tarifa de lista, solo si hay una promoción vigente (para mostrar «antes / ahora»). */
  listPriceUsd?: number;
  promotion?: { label: string; percent: number; endsOn: string | null };
  /** Foto del tipo de habitación (la que la residencia clasificó «Por tipo de habitación»); sin ella la tarjeta muestra la ilustración de marca. */
  photoUrl?: string;
  /** ARS redondeados (`usdToArsRounded`), solo para mostrar, siempre con `ExchangeRateNote`. */
  arsRounded: number;
  /** "2 personas por habitación · mixta · baño compartido" (solo lo cargado). */
  subtitle: string;
  /** Datos estructurados para íconos (solo lo cargado). */
  capacity?: number;
  genderLabel?: string;
  bathroom?: "privado" | "compartido";
  state: TypeAvailabilityState;
  /** DR69: 45 días sin actualizar; el tipo no admite solicitudes nuevas. */
  staleBlocked?: boolean;
  /**
   * Disponibilidad por género (migración 0075), solo cuando el tipo se ofrece en más de un género. Cada género con su propio estado;
   * el copy sale de `StatusTag`. La solicitud sigue siendo por tipo.
   */
  genderOffers?: { gender: string; label: string; state: TypeAvailabilityState; note: string | null }[];
};
