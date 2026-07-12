"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { updateAvailabilityAction, type AvailabilityActionState } from "@/app/residence/[residence_id]/availability/actions";

const initialState: AvailabilityActionState = { status: "idle" };

export function AvailabilityForm({
  residenceId,
  roomTypeId,
  currentStatus,
  currentAvailableCount,
  currentAvailableFrom,
  currentNotesPublic,
}: {
  residenceId: string;
  roomTypeId: string;
  currentStatus: string;
  currentAvailableCount: number | null;
  currentAvailableFrom: string | null;
  currentNotesPublic: string | null;
}) {
  const action = updateAvailabilityAction.bind(null, residenceId, roomTypeId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-sand-200 pt-4">
      <Select label="Estado" name="status" defaultValue={currentStatus} required>
        <option value="available_to_confirm">Disponible (a confirmar al solicitar)</option>
        <option value="full">Completa</option>
        <option value="paused_by_residence">Pausar solicitudes</option>
      </Select>
      <Input
        label="Lugares disponibles (opcional)"
        name="available_count"
        type="number"
        min={0}
        defaultValue={currentAvailableCount ?? undefined}
      />
      <Input
        label="Disponible desde (opcional)"
        name="available_from"
        type="date"
        defaultValue={currentAvailableFrom ?? undefined}
      />
      <Textarea label="Nota pública (opcional)" name="notes_public" rows={2} defaultValue={currentNotesPublic ?? ""} />

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && <p className="text-sm font-medium text-sage-700">Disponibilidad actualizada.</p>}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Guardando…" : "Actualizar disponibilidad"}
      </Button>
    </form>
  );
}
