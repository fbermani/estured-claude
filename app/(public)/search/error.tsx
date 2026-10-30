"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function SearchError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <EmptyState
        icon="error"
        title="No pudimos cargar las residencias"
        description="Hubo un problema de nuestro lado. Probá de nuevo en unos segundos."
        action={<Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>}
      />
    </div>
  );
}
