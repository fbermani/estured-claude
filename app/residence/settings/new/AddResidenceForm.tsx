"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PROPERTY_TYPE_OPTIONS, BARRIO_OPTIONS } from "@/lib/residences/options";
import { addResidence, type AddResidenceState } from "@/app/residence/settings/new/actions";

const initialState: AddResidenceState = { status: "idle" };

export function AddResidenceForm() {
  const [state, formAction, isPending] = useActionState(addResidence, initialState);

  return (
    <Card className="p-6 sm:p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <Input
          label="Nombre de la residencia"
          id="ar-residence-name"
          name="residence_name"
          placeholder="Ej: Residencia Los Andes"
          maxLength={160}
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select label="Tipo de propiedad" id="ar-property-type" name="property_type" required defaultValue="residencia_estudiantil">
            <option value="" disabled>
              Elegí una opción
            </option>
            {PROPERTY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select label="Barrio" id="ar-zone" name="zone" required defaultValue="">
            <option value="" disabled>
              Elegí una opción
            </option>
            {BARRIO_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Dirección completa"
          id="ar-address"
          name="address_line"
          placeholder="Calle, número, piso"
          hint="Privada — solo la ven vos y el equipo de EstuRed hasta la verificación."
          maxLength={200}
          required
        />

        <label className="flex items-start gap-3 rounded-field bg-sand-100 p-4 text-sm text-ink">
          <input type="checkbox" name="accept_responsibility" required className="mt-0.5 h-4 w-4 accent-forest" />
          <span>
            Entiendo que esta residencia solo se publica tras verificación presencial del equipo de EstuRed, y que soy
            responsable de la veracidad de la información que cargo.
          </span>
        </label>

        {state.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creando la residencia…" : "Crear residencia y continuar"}
        </Button>
      </form>
    </Card>
  );
}
