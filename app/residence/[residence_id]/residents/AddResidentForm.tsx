"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { createResidentStayAction, type ResidentsActionState } from "@/app/residence/[residence_id]/residents/actions";

const initialState: ResidentsActionState = { status: "idle" };

export function AddResidentForm({
  residenceId,
  roomTypes,
}: {
  residenceId: string;
  roomTypes: { id: string; name: string }[];
}) {
  const action = createResidentStayAction.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="rounded-card border border-sand-200 bg-sand-50 p-4">
      <h3 className="font-bold text-ink">Cargar residente</h3>
      <p className="mt-1 text-xs text-ink-faint">
        Cargalo con su email: lo activa después con ese mismo email. Si todavía no lo tenés, cargalo con nombre y apellido
        (y teléfono, si querés mandarle el mensaje de registro por WhatsApp): queda como &ldquo;residente sin activar&rdquo; hasta que le cargues el mail.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Email del residente" name="invite_email" type="email" hint="Dejalo vacío si todavía no lo tenés." />
        <Input label="Nombre y apellido (si no hay email)" name="invite_name" maxLength={80} />
        <Input
          label="Teléfono (opcional)"
          name="invite_phone"
          type="tel"
          inputMode="tel"
          hint="Con código de país, solo números (ej. 5491112345678). Solo se usa para armarte el mensaje de WhatsApp."
        />
        <Select label="Tipo de habitación (opcional)" name="room_type_id" defaultValue="">
          <option value="">Sin especificar</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </Select>
        <Input label="Fecha de ingreso (opcional)" name="start_date" type="date" />
        <Input
          label="Contrato hasta (opcional)"
          name="expected_end_date"
          type="date"
          hint="Salida estimada — se muestra en habitaciones y residentes."
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && <p className="mt-3 text-sm font-medium text-forest-700">Residente cargado.</p>}

      <Button type="submit" size="sm" className="mt-4" disabled={isPending}>
        {isPending ? "Cargando…" : "Cargar residente"}
      </Button>
    </form>
  );
}
