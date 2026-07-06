"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { submitWaitlist, type WaitlistState } from "@/app/(public)/waitlist/actions";

const initialState: WaitlistState = { status: "idle" };

export function WaitlistForm() {
  const [state, formAction, isPending] = useActionState(
    submitWaitlist,
    initialState,
  );

  if (state.status === "success") {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-2xl">
          ✓
        </span>
        <h2 className="mt-4 text-xl font-bold text-petrol-800">
          ¡Listo! Ya estás en la lista
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Te vamos a escribir apenas EstuRed esté activo en tu zona. Mientras
          tanto, podés explorar el catálogo de residencias verificadas.
        </p>
        <div className="mt-6">
          <Button href="/search" variant="outline">
            Explorar residencias
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <Select label="Soy..." id="wl-role" name="role" required defaultValue="">
          <option value="" disabled>
            Elegí una opción
          </option>
          <option value="student">Estudiante buscando residencia</option>
          <option value="family">Familiar de un estudiante</option>
          <option value="residence">Responsable de una residencia</option>
        </Select>
        <Input
          label="Nombre"
          id="wl-name"
          name="name"
          placeholder="Tu nombre"
          maxLength={120}
          required
        />
        <Input
          label="Email"
          id="wl-email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          maxLength={254}
          required
        />
        <Input
          label="Ciudad de origen (opcional)"
          id="wl-city"
          name="city"
          maxLength={120}
          placeholder="Ej: Córdoba, Mendoza, Lima..."
        />
        <Textarea
          label="Contanos qué estás buscando (opcional)"
          id="wl-message"
          name="message"
          maxLength={2000}
          placeholder="Fecha estimada de mudanza, presupuesto, zona preferida, o datos de tu residencia..."
        />
        {/* Honeypot anti-spam: oculto para humanos */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="wl-website">No completar</label>
          <input id="wl-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
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
          {isPending ? "Enviando…" : "Sumarme a la lista de espera"}
        </Button>
        <p className="text-xs text-ink-faint">
          Usamos tus datos solo para avisarte sobre el lanzamiento de EstuRed.
          No los compartimos con terceros.
        </p>
      </form>
    </Card>
  );
}
