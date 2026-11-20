"use client";

import { Button } from "@/components/ui/Button";
import { RoomTypeCards } from "@/components/residences/ficha/RoomTypeCards";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import type { FichaRoomType } from "@/components/residences/ficha/types";

/**
 * Contenido del panel de solicitud en la VISTA PREVIA del equipo (`/residence/[id]/preview`): mismo aspecto que ve un visitante, pero
 * sin acciones. Se puede mirar y marcar un tipo (solo estado local de pantalla), y el botón queda deshabilitado con un aviso. No envía
 * nada, no tiene enlaces de ingreso ni de registro y no llama a ninguna acción de servidor.
 */
export function PreviewRequestContent({ types }: { types: FichaRoomType[] }) {
  const { roomTypeId, setRoomTypeId } = useReservationSelection();
  const selected = types.some((t) => t.id === roomTypeId) ? (roomTypeId as string) : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
        <RoomTypeCards types={types} value={selected} onChange={setRoomTypeId} />
        <p role="status" className="rounded-field bg-amber-soft-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
          Es una vista previa: acá los estudiantes eligen su habitación y envían la solicitud. Todavía no se puede enviar nada.
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-line bg-paper px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-6px_16px_rgb(29_39_34/0.05)] sm:px-6">
        <Button type="button" variant="cta" size="cta" disabled aria-disabled="true">
          Pedir esta habitación
        </Button>
        <p className="text-center text-xs text-ink-faint">Toda reserva está sujeta a confirmación de la residencia.</p>
      </div>
    </div>
  );
}
