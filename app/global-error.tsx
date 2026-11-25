"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import "./globals.css";

/**
 * Último respaldo (P19-05): errores del layout raíz. Reemplaza a ese layout, así que arma su propio `<html>`.
 * Sin las fuentes ni los íconos del layout: usa la tipografía del sistema y ningún ícono. Sin detalles técnicos.
 */
const systemFonts = {
  "--font-hanken": "system-ui",
  "--font-bricolage": "system-ui",
} as CSSProperties;

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="es" style={systemFonts}>
      <body className="antialiased">
        <title>Algo salió mal | EstuRed</title>
        <main id="contenido" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold text-ink">Algo salió mal</h1>
          <p className="text-ink-soft">Hubo un problema de nuestro lado. Probá de nuevo en unos segundos.</p>
          <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
        </main>
      </body>
    </html>
  );
}
