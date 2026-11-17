"use client";

import { Button } from "@/components/ui/Button";
import { RoomTypeCards } from "@/components/residences/ficha/RoomTypeCards";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import type { FichaRoomType } from "@/components/residences/ficha/types";

/**
 * Contenido del panel de solicitud para quien no inició sesión: puede mirar y elegir el tipo, y para seguir se le pide
 * ingresar con su cuenta de estudiante; vuelve a la ficha con la elección guardada (`?room=…&solicitar=1`, igual que
 * el «Elegir» de la tabla). No envía nada.
 */
export function GuestRequestContent({ slug, types }: { slug: string; types: FichaRoomType[] }) {
  const { roomTypeId, setRoomTypeId } = useReservationSelection();
  const selected = types.some((t) => t.id === roomTypeId) ? (roomTypeId as string) : "";
  const next = `/residencias/${slug}?${selected ? `room=${selected}&` : ""}solicitar=1`;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
        <RoomTypeCards types={types} value={selected} onChange={setRoomTypeId} />
        <p className="rounded-field bg-sand-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
          Para elegir una habitación te pedimos que ingreses con tu cuenta de estudiante: volvés acá con tu elección
          guardada.
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-line bg-paper px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-6px_16px_rgb(29_39_34/0.05)] sm:px-6">
        <Button href={`/register/student?next=${encodeURIComponent(next)}`} variant="cta" size="cta">
          Crear cuenta de estudiante
        </Button>
        <Button href={loginHref} variant="outline" size="lg">
          Ya tengo cuenta
        </Button>
        <p className="text-center text-xs text-ink-faint">
          La residencia responde en hasta 48 horas. Toda reserva está sujeta a confirmación.
        </p>
      </div>
    </div>
  );
}
