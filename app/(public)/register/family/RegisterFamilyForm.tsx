"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  registerFamily,
  type RegisterFamilyState,
} from "@/app/(public)/register/family/actions";

const initialState: RegisterFamilyState = { status: "idle" };

const RELATIONSHIP_OPTIONS = [
  { value: "madre", label: "Madre" },
  { value: "padre", label: "Padre" },
  { value: "tutor", label: "Tutor/a" },
  { value: "familiar", label: "Otro familiar" },
];

export function RegisterFamilyForm() {
  const [state, formAction, isPending] = useActionState(registerFamily, initialState);

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Nombre" id="rf-first-name" name="first_name" autoComplete="given-name" maxLength={80} required />
          <Input label="Apellido" id="rf-last-name" name="last_name" autoComplete="family-name" maxLength={80} required />
        </div>
        <Select label="Tu relación con el estudiante" id="rf-relationship" name="relationship_type" required defaultValue="">
          <option value="" disabled>
            Elegí una opción
          </option>
          {RELATIONSHIP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Tu email" id="rf-email" name="email" type="email" autoComplete="email" required />
          <Input label="Tu teléfono" id="rf-phone" name="phone" type="tel" autoComplete="tel" required />
        </div>
        <Input
          label="Contraseña"
          id="rf-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          hint="Mínimo 8 caracteres."
          required
        />

        <div className="rounded-field bg-sand-100 p-4">
          <Input
            label="Email del estudiante a vincular"
            id="rf-student-email"
            name="student_email"
            type="email"
            placeholder="El email con el que se registró en EstuRed"
            hint="Tiene que tener una cuenta creada. Le vamos a pedir que apruebe el vínculo antes de que puedas ver nada."
            required
          />
        </div>

        <div className="flex flex-col gap-3 rounded-field bg-sand-100 p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="accept_terms" required className="mt-0.5 h-4 w-4 accent-petrol-600" />
            <span>Acepto los términos y condiciones de EstuRed.</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="accept_privacy" required className="mt-0.5 h-4 w-4 accent-petrol-600" />
            <span>
              Acepto la política de privacidad. Entiendo que solo voy a ver lo que el estudiante
              autorice.
            </span>
          </label>
        </div>

        {state.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creando tu cuenta…" : "Crear cuenta y solicitar vínculo"}
        </Button>
      </form>
    </Card>
  );
}
