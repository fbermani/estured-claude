"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatUsd } from "@/lib/mock/exchange";
import {
  createFamilyProposal,
  type CreateFamilyProposalState,
} from "@/app/students/family-proposals/actions";

interface RoomTypeOption {
  id: string;
  name: string;
  monthly_price_usd: number;
  profile_availability: { status: string }[];
}
interface StudentOption {
  id: string;
  first_name: string;
  last_initial: string;
}

const initialState: CreateFamilyProposalState = { status: "idle" };

export function ProposeForm({
  residenceId,
  roomTypes,
  students,
}: {
  residenceId: string;
  roomTypes: RoomTypeOption[];
  students: StudentOption[];
}) {
  const action = createFamilyProposal.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const availableTypes = roomTypes.filter((rt) => rt.profile_availability?.[0]?.status !== "full");

  if (students.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Necesitás tener al menos un estudiante vinculado activo para proponerle una residencia.
      </p>
    );
  }
  if (roomTypes.length === 0) {
    return <p className="text-sm text-ink-soft">Esta residencia todavía no cargó tipos de habitación.</p>;
  }
  if (availableTypes.length === 0) {
    return <p className="text-sm text-ink-soft">No hay lugares disponibles en este momento.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h3 className="font-bold text-petrol-800">Proponer esta residencia</h3>
      <p className="text-xs text-ink-faint">
        Le va a llegar como sugerencia a tu estudiante — recién se convierte en solicitud real si él o ella
        la aprueba, y en ese caso la residencia te va a contactar a vos.
      </p>
      {students.length > 1 && (
        <Select label="Estudiante" id="propose-student" name="student_profile_id" required defaultValue="">
          <option value="" disabled>
            Elegí a quién le proponés esto
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name} {s.last_initial}
            </option>
          ))}
        </Select>
      )}
      {students.length === 1 && <input type="hidden" name="student_profile_id" value={students[0].id} />}
      <Select label="Tipo de habitación" id="propose-room-type" name="room_type_id" required defaultValue="">
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
        label="Fecha de ingreso propuesta"
        id="propose-start-date"
        name="desired_start_date"
        type="date"
        required
      />
      <Input
        label="Duración propuesta (meses)"
        id="propose-duration"
        name="initial_duration_months"
        type="number"
        min={1}
        max={24}
        defaultValue={6}
        required
      />
      <Textarea
        label="Mensaje para tu estudiante (opcional)"
        id="propose-message"
        name="message_to_student"
        rows={3}
        placeholder="Ej: Vi esta residencia, está cerca de tu facultad y dentro del presupuesto."
      />

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar propuesta al estudiante"}
      </Button>
    </form>
  );
}
