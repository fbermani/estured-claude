"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatUsd } from "@/lib/mock/exchange";
import {
  createApplicationRequest,
  type CreateApplicationState,
} from "@/app/students/applications/actions";

interface RoomTypeOption {
  id: string;
  name: string;
  monthly_price_usd: number;
  profile_availability: { status: string }[];
}

const initialState: CreateApplicationState = { status: "idle" };

export function ApplyForm({
  residenceId,
  roomTypes,
}: {
  residenceId: string;
  roomTypes: RoomTypeOption[];
}) {
  const action = createApplicationRequest.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const availableTypes = roomTypes.filter((rt) => rt.profile_availability?.[0]?.status !== "full");

  if (roomTypes.length === 0) {
    return <p className="text-sm text-ink-soft">Esta residencia todavía no cargó tipos de habitación.</p>;
  }
  if (availableTypes.length === 0) {
    return <p className="text-sm text-ink-soft">No hay lugares disponibles en este momento.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h3 className="font-bold text-petrol-800">Enviar solicitud de reserva</h3>
      <Select label="Tipo de habitación" id="apply-room-type" name="room_type_id" required defaultValue="">
        <option value="" disabled>
          Elegí una opción
        </option>
        {availableTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.name} — {formatUsd(Number(rt.monthly_price_usd))}/mes
          </option>
        ))}
      </Select>
      <Input
        label="Fecha de ingreso deseada"
        id="apply-start-date"
        name="desired_start_date"
        type="date"
        required
      />
      <Input
        label="Duración estimada (meses)"
        id="apply-duration"
        name="initial_duration_months"
        type="number"
        min={1}
        max={24}
        defaultValue={6}
        required
      />
      <Textarea
        label="¿Cuál es tu objetivo académico?"
        id="apply-objective"
        name="academic_objective"
        rows={3}
        placeholder="Ej: Iniciar mi carrera universitaria en CABA durante el ciclo lectivo actual."
        hint="Obligatorio — se usa para tu comprobante de reserva."
        required
      />

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar solicitud de reserva"}
      </Button>
    </form>
  );
}
