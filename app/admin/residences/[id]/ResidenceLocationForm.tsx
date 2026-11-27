"use client";

import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { geocodeResidenceAction, updateResidenceLocationAction, type ResidenceLocationActionState } from "@/app/admin/residences/actions";
import { Input } from "@/components/ui/Input";

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
  const [geoState, geoAction, geoPending] = useActionState(geocodeResidenceAction.bind(null, residenceId), initialState);

  return (
    <>
    <form action={geoAction} className="mt-3 space-y-1">
      <AdminButton type="submit" variant="secondary" className="!px-4 !py-1.5 text-xs" disabled={geoPending}>
        {geoPending ? "Buscando…" : "Ubicar desde la dirección"}
      </AdminButton>
      {geoState.status !== "idle" && (
        <p role={geoState.status === "error" ? "alert" : "status"} className="text-xs font-medium" style={{ color: geoState.status === "error" ? cmd.rose : cmd.primary }}>
          {geoState.message}
        </p>
      )}
    </form>
    <form action={formAction} className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Latitud" name="latitude" defaultValue={latitude ?? ""} placeholder="-34.581234" />
        <Input label="Longitud" name="longitude" defaultValue={longitude ?? ""} placeholder="-58.421567" />
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
    </>
  );
}
