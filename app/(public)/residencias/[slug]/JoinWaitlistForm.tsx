"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import { joinWaitlistAction, type JoinWaitlistState } from "@/app/(public)/residencias/[slug]/waitlist-actions";

interface RoomTypeOption {
  id: string;
  name: string;
}

const initialState: JoinWaitlistState = { status: "idle" };

export function JoinWaitlistForm({
  residenceId,
  roomTypes,
  minStartDate,
}: {
  residenceId: string;
  roomTypes: RoomTypeOption[];
  /** Reserva vigente (Ciclo 58): la fecha de ingreso es obligatoria y no puede ser anterior. El servidor igual valida. */
  minStartDate?: string | null;
}) {
  const action = joinWaitlistAction.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  // El tipo que la persona venía mirando en la ficha (por ejemplo, el que tocó "Lista de espera") llega preelegido.
  const { roomTypeId } = useReservationSelection();
  const preselected = roomTypes.some((rt) => rt.id === roomTypeId) ? (roomTypeId as string) : "";

  if (state.status === "saved") {
    return (
      <div className="px-5 py-5 sm:px-6">
        <p className="rounded-field bg-mint px-4 py-3 text-sm text-forest-700">
          Te sumamos a la lista de espera. Te avisamos si se libera un lugar.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 px-5 py-5 sm:px-6">
      <p className="text-sm text-ink-soft">No hay lugares disponibles en este momento.</p>
      <Select key={preselected} label="Tipo de habitación (opcional)" id="waitlist-room-type" name="room_type_id" defaultValue={preselected}>
        <option value="">Cualquiera</option>
        {roomTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.name}
          </option>
        ))}
      </Select>

      {minStartDate && (
        <Input
          label="Fecha de ingreso deseada"
          id="waitlist-start-date"
          name="desired_start_date"
          type="date"
          required
          min={minStartDate}
          hint={`Podés anotarte desde el ${formatDateOnly(minStartDate)}, cuando termina tu reserva actual.`}
        />
      )}

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Sumando…" : "Sumarme a lista de espera"}
      </Button>
    </form>
  );
}
