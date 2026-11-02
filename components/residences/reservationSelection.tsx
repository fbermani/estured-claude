"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Estado compartido de la ficha entre la tabla de tarifas, el modal de solicitud (`RequestSheet`, DR30 §6) y
 * `CommunityBrowser`, sin pasar por navegación.
 *
 * - `roomTypeId`: el tipo de habitación elegido. Elegirlo en la tabla, en la card lateral o con `?room=` es
 *   el mismo estado (SPEC §4.1). Pedido original del dueño (Ciclo 35octodevicies): seleccionar una plaza debe
 *   completar el formulario y recalcular precios en tiempo real.
 * - `sheet`: qué hoja está abierta (`request` = solicitud o propuesta, `waitlist` = lista de espera) o `null`.
 *
 * Viven en el mismo árbol de cliente gracias a `ReservationSelectionProvider` en `page.tsx`, que envuelve la
 * página como children (patrón "Server Component como children de un Client Component").
 */

export type SheetMode = "request" | "waitlist";

interface ReservationSelectionValue {
  roomTypeId: string | null;
  /** Identifica la plaza puntual elegida, solo para resaltarla visualmente — la reserva sigue siendo a nivel de tipo de habitación (docs: sin disponibilidad por cama individual). */
  slotKey: string | null;
  /** Selección desde una plaza puntual en CommunityBrowser: fija tipo + plaza y abre el modal de solicitud. */
  select: (roomTypeId: string, slotKey: string) => void;
  /** Cambio manual (tabla de tarifas, card o dropdown del formulario): ya no corresponde a una plaza puntual. */
  setRoomTypeId: (roomTypeId: string) => void;
  /** Hoja abierta, o `null`. */
  sheet: SheetMode | null;
  openSheet: (mode?: SheetMode) => void;
  closeSheet: () => void;
  /** ¿Hay un modal de solicitud montado en esta página? (solo en la ficha, para estudiantes y familiares). */
  hasSheet: boolean;
  /** Lo llama `RequestSheet` al montarse; devuelve la función que lo desregistra. */
  registerSheet: () => () => void;
}

const ReservationSelectionContext = createContext<ReservationSelectionValue | null>(null);

export function ReservationSelectionProvider({
  initialRoomTypeId,
  initialSheet = null,
  children,
}: {
  initialRoomTypeId?: string;
  /** Abre la hoja al cargar (vuelta del login con `?solicitar=1`). */
  initialSheet?: SheetMode | null;
  children: ReactNode;
}) {
  const [roomTypeId, setRoomTypeIdState] = useState<string | null>(initialRoomTypeId ?? null);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetMode | null>(initialSheet);

  const [hasSheet, setHasSheet] = useState(false);
  const hasSheetRef = useRef(false);
  const registerSheet = useCallback(() => {
    hasSheetRef.current = true;
    setHasSheet(true);
    return () => {
      hasSheetRef.current = false;
      setHasSheet(false);
    };
  }, []);

  const select = useCallback((newRoomTypeId: string, newSlotKey: string) => {
    setRoomTypeIdState(newRoomTypeId);
    setSlotKey(newSlotKey);
    if (hasSheetRef.current) setSheet("request");
  }, []);

  const setRoomTypeId = useCallback((newRoomTypeId: string) => {
    setRoomTypeIdState(newRoomTypeId);
    setSlotKey(null);
  }, []);

  const openSheet = useCallback((mode: SheetMode = "request") => setSheet(mode), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <ReservationSelectionContext.Provider
      value={{ roomTypeId, slotKey, select, setRoomTypeId, sheet, openSheet, closeSheet, hasSheet, registerSheet }}
    >
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
