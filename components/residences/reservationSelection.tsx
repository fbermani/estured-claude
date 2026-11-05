"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Estado compartido de la ficha entre la tabla de tarifas, el panel de solicitud (`RequestPanel`) y
 * `CommunityBrowser`, sin pasar por navegación.
 *
 * - `roomTypeId`: el tipo de habitación elegido. Elegirlo en la tabla, en el panel o con `?room=` es
 *   el mismo estado (SPEC §4.1). Pedido original del dueño (Ciclo 35octodevicies): seleccionar una plaza debe
 *   completar el formulario y recalcular precios en tiempo real.
 * - `panelMode`: qué contenido muestra el panel (`request` = solicitud o propuesta, `waitlist` = lista de espera).
 * - `sheetOpen`: solo importa en móvil (< 900 px), donde el panel es una hoja inferior modal. En escritorio el
 *   panel siempre está a la vista y `openSheet` solo lleva el foco ahí (`openTick` avisa que hubo un pedido).
 *
 * Viven en el mismo árbol de cliente gracias a `ReservationSelectionProvider` en `page.tsx`, que envuelve la
 * página como children (patrón "Server Component como children de un Client Component").
 */

export type SheetMode = "request" | "waitlist";

interface ReservationSelectionValue {
  roomTypeId: string | null;
  /** Identifica la plaza puntual elegida, solo para resaltarla visualmente — la reserva sigue siendo a nivel de tipo de habitación (docs: sin disponibilidad por cama individual). */
  slotKey: string | null;
  /** Selección desde una plaza puntual en CommunityBrowser: fija tipo + plaza y lleva al panel de solicitud. */
  select: (roomTypeId: string, slotKey: string) => void;
  /** Cambio manual (tabla de tarifas, panel o card): ya no corresponde a una plaza puntual. */
  setRoomTypeId: (roomTypeId: string) => void;
  /** Contenido del panel: solicitud o lista de espera. */
  panelMode: SheetMode;
  setPanelMode: (mode: SheetMode) => void;
  /** Hoja abierta (solo tiene efecto visual en móvil). */
  sheetOpen: boolean;
  /** Se incrementa en cada pedido de abrir el panel (para enfocarlo en escritorio / abrir la hoja en móvil). */
  openTick: number;
  openSheet: (mode?: SheetMode) => void;
  closeSheet: () => void;
  /** ¿Hay un panel de solicitud montado en esta página? (solo en la ficha, para estudiantes y familiares). */
  hasSheet: boolean;
  /** Lo llama `RequestPanel` al montarse; devuelve la función que lo desregistra. */
  registerSheet: () => () => void;
}

const ReservationSelectionContext = createContext<ReservationSelectionValue | null>(null);

export function ReservationSelectionProvider({
  initialRoomTypeId,
  initialSheet = null,
  children,
}: {
  initialRoomTypeId?: string;
  /** Lleva al panel al cargar (vuelta del login con `?solicitar=1`): enfoca el panel en escritorio, abre la hoja en móvil. */
  initialSheet?: SheetMode | null;
  children: ReactNode;
}) {
  const [roomTypeId, setRoomTypeIdState] = useState<string | null>(initialRoomTypeId ?? null);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<SheetMode>(initialSheet ?? "request");
  const [sheetOpen, setSheetOpen] = useState(initialSheet !== null);
  const [openTick, setOpenTick] = useState(initialSheet !== null ? 1 : 0);

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

  const openSheet = useCallback((mode: SheetMode = "request") => {
    setPanelMode(mode);
    setSheetOpen(true);
    setOpenTick((t) => t + 1);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const select = useCallback(
    (newRoomTypeId: string, newSlotKey: string) => {
      setRoomTypeIdState(newRoomTypeId);
      setSlotKey(newSlotKey);
      if (hasSheetRef.current) openSheet("request");
    },
    [openSheet],
  );

  const setRoomTypeId = useCallback((newRoomTypeId: string) => {
    setRoomTypeIdState(newRoomTypeId);
    setSlotKey(null);
  }, []);

  return (
    <ReservationSelectionContext.Provider
      value={{
        roomTypeId,
        slotKey,
        select,
        setRoomTypeId,
        panelMode,
        setPanelMode,
        sheetOpen,
        openTick,
        openSheet,
        closeSheet,
        hasSheet,
        registerSheet,
      }}
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
