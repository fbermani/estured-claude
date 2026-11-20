"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { SkipLink } from "@/components/ui/SkipLink";
import { InstallBanner } from "@/components/install/InstallBanner";

/**
 * Marco del área de una residencia (`/residence/[residence_id]/…`): menú lateral + contenido, con el tono petróleo del panel. La vista
 * previa de la ficha (`/residence/[residence_id]/preview`) se muestra SIN este marco: es la ficha pública a pantalla completa, con su
 * propia barra «Vista previa», y el menú lateral (y su barra inferior en celular) le quitarían ancho y taparían sus barras fijas.
 * La decisión es solo de presentación: el acceso a la vista previa lo valida la propia página en el servidor.
 */
export function ResidenceAreaShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  if (segment === "preview") return <>{children}</>;
  return (
    <div id="area-shell" className="tone-residence flex min-h-screen flex-col bg-cream md:flex-row">
      <SkipLink />
      {sidebar}
      <main id="contenido" tabIndex={-1} className="min-w-0 focus:outline-none flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <InstallBanner />
        {children}
      </main>
    </div>
  );
}
