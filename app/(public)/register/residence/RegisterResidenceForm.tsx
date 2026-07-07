"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { PROPERTY_TYPE_OPTIONS, ZONE_OPTIONS } from "@/lib/residences/options";
import {
  registerResidence,
  type RegisterResidenceState,
} from "@/app/(public)/register/residence/actions";

const initialState: RegisterResidenceState = { status: "idle" };

export function RegisterResidenceForm() {
  const [state, formAction, isPending] = useActionState(
    registerResidence,
    initialState,
  );

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <Input
          label="Nombre del responsable"
          id="rr-responsible-name"
          name="responsible_name"
          autoComplete="name"
          maxLength={120}
          required
        />
        <Input
          label="Nombre de la residencia"
          id="rr-residence-name"
          name="residence_name"
          placeholder="Ej: Residencia Los Andes"
          maxLength={160}
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select label="Tipo de propiedad" id="rr-property-type" name="property_type" required defaultValue="">
            <option value="" disabled>
              Elegí una opción
            </option>
            {PROPERTY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select label="Zona" id="rr-zone" name="zone" required defaultValue="">
            <option value="" disabled>
              Elegí una opción
            </option>
            {ZONE_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Dirección completa"
          id="rr-address"
          name="address_line"
          placeholder="Calle, número, piso"
          hint="Privada — solo la ven vos y el equipo de EstuRed hasta la verificación."
          maxLength={200}
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Email"
            id="rr-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            required
          />
          <Input
            label="Teléfono"
            id="rr-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+54 9 11 ..."
            required
          />
        </div>
        <Input
          label="Contraseña"
          id="rr-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          hint="Mínimo 8 caracteres."
          required
        />

        <div className="flex flex-col gap-3 rounded-field bg-sand-100 p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="accept_terms"
              required
              className="mt-0.5 h-4 w-4 accent-petrol-600"
            />
            <span>
              Acepto los términos y condiciones de EstuRed como residencia
              asociada.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="accept_responsibility"
              required
              className="mt-0.5 h-4 w-4 accent-petrol-600"
            />
            <span>
              Entiendo que mi residencia solo se publica tras verificación
              presencial del equipo de EstuRed, y que soy responsable de la
              veracidad de la información que cargo.
            </span>
          </label>
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg"
          >
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creando tu cuenta…" : "Crear cuenta y continuar"}
        </Button>
      </form>
    </Card>
  );
}
