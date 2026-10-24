"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { StayChangeSubmit } from "@/components/students/StayChangeSubmit";
import { DEPOSIT_STATUS_LABELS, UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";
import { MAX_EXIT_RESIDENCE_NOTE } from "@/lib/stayChange/validate";
import { endResidentStayEarlyExitAction, type ResidentsActionState } from "@/app/residence/[residence_id]/residents/actions";

function arToday(): Date {
  return new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())}T00:00:00Z`);
}
function exitBounds(): { min: string; max: string } {
  const min = arToday();
  min.setUTCMonth(min.getUTCMonth() - 12);
  const max = new Date(arToday().getTime() + 7 * 86_400_000);
  return { min: min.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
}

const initialState: ResidentsActionState = { status: "idle" };

/**
 * Cierre de la salida anticipada (DR3): la salida SIEMPRE la inicia la residencia actual. Pide la fecha real, qué pasó con el
 * depósito (devuelto / no devuelto / sin depósito; si la reserva tenía depósito no se ofrece "sin depósito") y una nota libre.
 * Después de enviar, la estadía se finaliza y el residente deja de aparecer en la comunidad visible.
 */
export function EarlyExitForm({
  residenceId,
  stayId,
  residentName,
  depositMode,
  suggestedDate,
  onCancel,
}: {
  residenceId: string;
  stayId: string;
  residentName: string;
  depositMode: "had" | "none" | "unknown";
  suggestedDate: string | null;
  onCancel: () => void;
}) {
  const action = endResidentStayEarlyExitAction.bind(null, residenceId, stayId);
  const [state, formAction] = useActionState(action, initialState);
  const options: (keyof typeof DEPOSIT_STATUS_LABELS)[] =
    depositMode === "had" ? ["returned", "not_returned"] : depositMode === "none" ? ["no_deposit"] : ["returned", "not_returned", "no_deposit"];

  if (state.status === "saved") {
    return (
      <p role="status" className="mt-2 rounded-field bg-success-bg px-3 py-2 text-xs font-medium leading-relaxed text-success-fg">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-field border border-danger-fg/30 bg-paper p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <Icon name="logout" className="text-lg text-danger-fg" /> Registrar salida anticipada de {residentName}
      </p>
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-3 py-2 text-xs font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
      <Input
        label="Fecha real de salida"
        name="exit_date"
        type="date"
        required
        min={exitBounds().min}
        max={exitBounds().max}
        defaultValue={suggestedDate ?? ""}
        hint="Hasta 7 días después de hoy, o hasta 12 meses atrás."
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink-soft">Depósito</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((key, index) => (
            <label
              key={key}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-field border-[1.5px] border-line-2 bg-paper px-3 py-2 text-sm font-semibold text-ink has-[:checked]:border-forest has-[:checked]:bg-forest-tint"
            >
              <input
                type="radio"
                name="deposit_status"
                value={key}
                required
                defaultChecked={options.length === 1 && index === 0}
                className="size-4 accent-[var(--color-forest)]"
              />
              {DEPOSIT_STATUS_LABELS[key]}
            </label>
          ))}
        </div>
        {depositMode === "none" && (
          <p className="mt-1.5 text-xs text-ink-faint">La reserva no tenía depósito.</p>
        )}
      </fieldset>
      </div>
      <Textarea
        label="Nota de la residencia (opcional)"
        name="residence_note"
        rows={6}
        maxLength={MAX_EXIT_RESIDENCE_NOTE}
        hint="La ve el residente y su familiar vinculado."
      />
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        Al registrar la salida se finaliza la estadía y el residente sale de la comunidad visible. {UNPAID_DISCLAIMER}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <StayChangeSubmit pendingLabel="Registrando…" danger>
          Registrar salida
        </StayChangeSubmit>
        <button type="button" onClick={onCancel} className="min-h-10 px-3 text-sm font-semibold text-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
