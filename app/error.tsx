"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/** Límite de error de respaldo para las rutas sin uno propio (preapertura, familia, notificaciones, etc.): sin detalles técnicos. */
export default function RootError({ reset }: { reset: () => void }) {
  return (
    <main id="contenido" className="mx-auto max-w-[80rem] px-4 py-14 sm:px-6">
      <EmptyState
        icon="error"
        title="Algo salió mal"
        description="Hubo un problema de nuestro lado. Probá de nuevo en unos segundos."
        action={<Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>}
      />
    </main>
  );
}
