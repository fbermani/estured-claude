"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { fieldHint, fieldProps, useFocusOnError } from "@/app/(public)/register/useRegisterFormErrors";
import {
  registerFamily,
  type RegisterFamilyState,
} from "@/app/(public)/register/family/actions";

const initialState: RegisterFamilyState = { status: "idle" };

const RELATIONSHIP_OPTIONS = [
  { value: "madre", label: "Madre" },
  { value: "padre", label: "Padre" },
  { value: "tutor", label: "Tutor o tutora" },
  { value: "familiar", label: "Otro familiar" },
];

export function RegisterFamilyForm() {
  const [state, formAction, isPending] = useActionState(registerFamily, initialState);
  const { formRef, alertRef } = useFocusOnError(state);

  return (
    <Card className="p-8">
      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Nombre" id="rf-first-name" name="first_name" autoComplete="given-name" maxLength={80} required {...fieldProps(state, "first_name", "rf")} hint={fieldHint(state, "first_name", "rf", undefined)} />
          <Input label="Apellido" id="rf-last-name" name="last_name" autoComplete="family-name" maxLength={80} required {...fieldProps(state, "last_name", "rf")} hint={fieldHint(state, "last_name", "rf", undefined)} />
        </div>
        <Select label="Tu relación con el estudiante" id="rf-relationship" name="relationship_type" required {...fieldProps(state, "relationship_type", "rf")} hint={fieldHint(state, "relationship_type", "rf", undefined)} >
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
          <Input label="Tu email" id="rf-email" name="email" type="email" autoComplete="email" required {...fieldProps(state, "email", "rf")} hint={fieldHint(state, "email", "rf", undefined)} />
          <Input label="Tu teléfono" id="rf-phone" name="phone" type="tel" autoComplete="tel" required {...fieldProps(state, "phone", "rf")} hint={fieldHint(state, "phone", "rf", undefined)} />
        </div>
        <Input
          label="Contraseña"
          id="rf-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required {...fieldProps(state, "password", "rf", undefined, false)} hint={fieldHint(state, "password", "rf", "Mínimo 8 caracteres.")} />

        <div className="rounded-field bg-sand-100 p-4">
          <Input
            label="Email del estudiante a vincular"
            id="rf-student-email"
            name="student_email"
            type="email"
            placeholder="El email con el que se registró en EstuRed"
            required {...fieldProps(state, "student_email", "rf")} hint={fieldHint(state, "student_email", "rf", "Tiene que tener una cuenta creada. Le vamos a pedir que apruebe el vínculo antes de que puedas ver nada.")} />
        </div>

        <div className="flex flex-col gap-3 rounded-field bg-sand-100 p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="accept_terms" required className="mt-0.5 h-4 w-4 accent-forest" />
            <span>
              Acepto los{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">términos y condiciones</a> de EstuRed.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" name="accept_privacy" required className="mt-0.5 h-4 w-4 accent-forest" />
            <span>
              Acepto la{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">política de privacidad</a>. Entiendo que solo voy a ver lo que el estudiante
              autorice.
            </span>
          </label>
        </div>

        {state.status === "error" && (
          <p role="alert" ref={alertRef} tabIndex={-1} className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg focus:outline-2 focus:outline-danger-fg">
            {state.message}
          </p>
        )}

        <TurnstileWidget resetKey={state} />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creando tu cuenta…" : "Crear cuenta y pedir el vínculo"}
        </Button>
      </form>
    </Card>
  );
}
