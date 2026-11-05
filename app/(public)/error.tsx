"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/** Límite de error de las páginas públicas: mensaje accionable en español, sin detalles técnicos. */
export default function PublicError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-[80rem] px-4 py-14 sm:px-6">
      <EmptyState
        icon="error"
        title="Algo salió mal"
        description="Hubo un problema de nuestro lado. Probá de nuevo en unos segundos."
        action={<Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>}
      />
    </div>
  );
}
