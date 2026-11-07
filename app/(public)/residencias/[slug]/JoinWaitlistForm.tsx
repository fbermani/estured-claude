"use client";

import { useActionState, useMemo } from "react";
import { DrawCheck } from "@/components/ui/DrawCheck";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { buildMonthOptions, WAITLIST_ANY_MONTH_VALUE } from "@/lib/waitlist-entries/desiredMonth";
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
  /** Reserva vigente (Ciclo 58): solo se ofrecen meses desde el mes en que termina. El servidor igual valida. */
  minStartDate?: string | null;
}) {
  const action = joinWaitlistAction.bind(null, residenceId);
  const monthOptions = useMemo(() => buildMonthOptions(new Date(), minStartDate), [minStartDate]);
  const [state, formAction, isPending] = useActionState(action, initialState);
  // El tipo que la persona venía mirando en la ficha (por ejemplo, el que tocó "Lista de espera") llega preelegido.
  const { roomTypeId } = useReservationSelection();
  const preselected = roomTypes.some((rt) => rt.id === roomTypeId) ? (roomTypeId as string) : "";

  if (state.status === "saved") {
    return (
      <div className="px-5 py-5 sm:px-6">
        <div role="status" className="flex items-center gap-3 rounded-field bg-mint px-4 py-3 text-sm text-forest-700">
          <DrawCheck className="size-10" />
          <p className="dc-rise">Te sumamos a la lista de espera. Te avisamos si se libera un lugar.</p>
        </div>
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

      <Select
        label="¿Para qué mes?"
        id="waitlist-start-month"
        name="desired_start_date"
        required
        defaultValue=""
        hint={minStartDate ? "Solo meses posteriores a tu reserva actual." : "Si el mes pasa sin lugar, salís de la lista y podés sumarte de nuevo."}
      >
        <option value="" disabled>
          Elegí un mes
        </option>
        {monthOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {/* Con reserva/estadía vigente no hay «Cuando haya lugar»: sin mes se considera superpuesto (docs/04 §5.6bis, DR40). */}
        {!minStartDate && <option value={WAITLIST_ANY_MONTH_VALUE}>Cuando haya lugar</option>}
      </Select>

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
