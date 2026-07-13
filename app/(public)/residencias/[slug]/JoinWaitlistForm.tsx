"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { joinWaitlistAction, type JoinWaitlistState } from "@/app/(public)/residencias/[slug]/waitlist-actions";

interface RoomTypeOption {
  id: string;
  name: string;
}

const initialState: JoinWaitlistState = { status: "idle" };

export function JoinWaitlistForm({ residenceId, roomTypes }: { residenceId: string; roomTypes: RoomTypeOption[] }) {
  const action = joinWaitlistAction.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "saved") {
    return (
      <p className="rounded-field bg-mint px-4 py-3 text-sm text-forest-700">
        Te sumamos a la lista de espera. Te avisamos si se libera un lugar.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">No hay lugares disponibles en este momento.</p>
      <Select label="Tipo de habitación (opcional)" id="waitlist-room-type" name="room_type_id" defaultValue="">
        <option value="">Cualquiera</option>
        {roomTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.name}
          </option>
        ))}
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
