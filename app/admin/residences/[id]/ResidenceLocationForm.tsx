"use client";

import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { updateResidenceLocationAction, type ResidenceLocationActionState } from "@/app/admin/residences/actions";

const initialState: ResidenceLocationActionState = { status: "idle" };

/** Carga de la coordenada de la residencia para el mapa público (pin exacto; la ubicación es pública). */
export function ResidenceLocationForm({
  residenceId,
  latitude,
  longitude,
}: {
  residenceId: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const action = updateResidenceLocationAction.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const inputStyle = { border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface };

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold" style={{ color: cmd.onSurfaceVariant }}>
          Latitud
          <input
            name="latitude"
            inputMode="decimal"
            defaultValue={latitude ?? ""}
            placeholder="-34.581234"
            className="mt-1 w-full rounded-xl px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="block text-xs font-semibold" style={{ color: cmd.onSurfaceVariant }}>
          Longitud
          <input
            name="longitude"
            inputMode="decimal"
            defaultValue={longitude ?? ""}
            placeholder="-58.421567"
            className="mt-1 w-full rounded-xl px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>
      <p className="text-xs" style={{ color: cmd.outline }}>
        Pegá la coordenada de la dirección (por ejemplo, desde Google Maps, clic derecho sobre el punto). La ficha
        muestra el pin en ese punto. Dejá las dos vacías para mostrar solo la ubicación aproximada del barrio.
      </p>
      {state.status === "error" && (
        <p role="alert" className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-xs font-medium" style={{ color: cmd.primary }}>
          {state.message}
        </p>
      )}
      <AdminButton type="submit" variant="primary" className="!px-4 !py-1.5 text-xs" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar ubicación"}
      </AdminButton>
    </form>
  );
}
