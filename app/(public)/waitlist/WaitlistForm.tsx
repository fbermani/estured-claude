"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

/**
 * Formulario de lista de espera del ciclo fundacional.
 *
 * Todavía no persiste datos: no hay backend en este ciclo. Cuando exista
 * Supabase, este submit se reemplaza por una server action con
 * validación server-side (docs/11 §5.2) — nunca escribir directo desde
 * el cliente.
 */
export function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
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
        <p className="mt-4 text-xs text-ink-faint">
          Nota del prototipo: en esta etapa los datos aún no se guardan.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
          required
        />
        <Input
          label="Email"
          id="wl-email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
        />
        <Input
          label="Ciudad de origen (opcional)"
          id="wl-city"
          name="city"
          placeholder="Ej: Córdoba, Mendoza, Lima..."
        />
        <Textarea
          label="Contanos qué estás buscando (opcional)"
          id="wl-message"
          name="message"
          placeholder="Fecha estimada de mudanza, presupuesto, zona preferida, o datos de tu residencia..."
        />
        <Button type="submit" size="lg">
          Sumarme a la lista de espera
        </Button>
        <p className="text-xs text-ink-faint">
          Usamos tus datos solo para avisarte sobre el lanzamiento de EstuRed.
          No los compartimos con terceros.
        </p>
      </form>
    </Card>
  );
}
