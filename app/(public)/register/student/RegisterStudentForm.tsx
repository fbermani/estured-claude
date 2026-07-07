"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  registerStudent,
  type RegisterState,
} from "@/app/(public)/register/student/actions";

const initialState: RegisterState = { status: "idle" };

export function RegisterStudentForm() {
  const [state, formAction, isPending] = useActionState(
    registerStudent,
    initialState,
  );

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Nombre"
            id="reg-first-name"
            name="first_name"
            autoComplete="given-name"
            maxLength={80}
            required
          />
          <Input
            label="Apellido"
            id="reg-last-name"
            name="last_name"
            autoComplete="family-name"
            maxLength={80}
            hint="Privado — solo se muestra tu inicial."
            required
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Fecha de nacimiento"
            id="reg-birth-date"
            name="birth_date"
            type="date"
            hint="Privada. Si sos menor, vas a necesitar vincular un familiar."
            required
          />
          <Input
            label="Nacionalidad"
            id="reg-nationality"
            name="nationality"
            placeholder="Ej: Argentina"
            maxLength={60}
            required
          />
        </div>
        <Input
          label="¿Dónde vas a estudiar?"
          id="reg-institution"
          name="study_institution"
          placeholder="Ej: UBA Medicina, Universidad de Palermo…"
          hint="Privado — nos ayuda a mostrarte residencias bien ubicadas."
          maxLength={160}
          required
        />
        <Input
          label="Ciudad de origen (opcional)"
          id="reg-origin-city"
          name="origin_city"
          placeholder="Ej: Córdoba, Mendoza, Lima…"
          maxLength={120}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Email"
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            required
          />
          <Input
            label="Teléfono"
            id="reg-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+54 9 11 ..."
            hint="Privado. Necesario para coordinar tu solicitud."
            required
          />
        </div>
        <Input
          label="Contraseña"
          id="reg-password"
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
              Acepto los términos y condiciones de EstuRed y entiendo que actúa
              como plataforma intermediaria de solicitud, registro, soporte y
              comprobante.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="accept_privacy"
              required
              className="mt-0.5 h-4 w-4 accent-petrol-600"
            />
            <span>
              Acepto la política de privacidad. Mis datos sensibles (apellido,
              fecha de nacimiento, universidad, contacto) nunca se muestran
              públicamente.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="profile_visible"
              className="mt-0.5 h-4 w-4 accent-petrol-600"
            />
            <span>
              Quiero que mi perfil de comunidad (nombre e inicial) pueda verse
              en las residencias donde viva.{" "}
              <span className="text-ink-faint">
                Opcional — podés cambiarlo cuando quieras.
              </span>
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
          {isPending ? "Creando tu cuenta…" : "Crear mi cuenta"}
        </Button>
      </form>
    </Card>
  );
}
