"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Estado compartido entre `CommunityBrowser` (elegir una cama libre) y
 * `ApplyForm` ("Tu solicitud de reserva") sin pasar por navegación —
 * pedido del dueño en Ciclo 35octodevicies: seleccionar una plaza debe
 * completar el formulario y recalcular precios en tiempo real, sin
 * recargar la página. Viven en el mismo árbol de cliente gracias a
 * `ReservationSelectionProvider` en `page.tsx`, que envuelve toda la
 * página como children (patrón "Server Component como children de un
 * Client Component" — no fuerza a nada más a volverse cliente).
 */

interface ReservationSelectionValue {
  roomTypeId: string | null;
  /** Identifica la plaza puntual elegida, solo para resaltarla visualmente — la reserva sigue siendo a nivel de tipo de habitación (docs: sin disponibilidad por cama individual). */
  slotKey: string | null;
  /** Selección desde una plaza puntual en CommunityBrowser: fija tipo + plaza y lleva al formulario. */
  select: (roomTypeId: string, slotKey: string) => void;
  /** Cambio manual desde el propio formulario (dropdown "Tipo de habitación"): ya no corresponde a una plaza puntual. */
  setRoomTypeId: (roomTypeId: string) => void;
}

const ReservationSelectionContext = createContext<ReservationSelectionValue | null>(null);

export function ReservationSelectionProvider({
  initialRoomTypeId,
  children,
}: {
  initialRoomTypeId?: string;
  children: ReactNode;
}) {
  const [roomTypeId, setRoomTypeIdState] = useState<string | null>(initialRoomTypeId ?? null);
  const [slotKey, setSlotKey] = useState<string | null>(null);

  const select = useCallback((newRoomTypeId: string, newSlotKey: string) => {
    setRoomTypeIdState(newRoomTypeId);
    setSlotKey(newSlotKey);
    document.getElementById("solicitud")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const setRoomTypeId = useCallback((newRoomTypeId: string) => {
    setRoomTypeIdState(newRoomTypeId);
    setSlotKey(null);
  }, []);

  return (
    <ReservationSelectionContext.Provider value={{ roomTypeId, slotKey, select, setRoomTypeId }}>
      {children}
    </ReservationSelectionContext.Provider>
  );
}

export function useReservationSelection() {
  const ctx = useContext(ReservationSelectionContext);
  if (!ctx) {
    throw new Error("useReservationSelection debe usarse dentro de ReservationSelectionProvider");
  }
  return ctx;
}
