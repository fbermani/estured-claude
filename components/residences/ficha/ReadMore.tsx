"use client";

import { useState } from "react";

/** Texto recortado a unas líneas con "Leer más" (descripción de la residencia en el encabezado de la ficha). */
export function ReadMore({ text, lines = 3 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  // Heurística simple sin medir el DOM: por debajo de este largo el texto entra casi siempre en el recorte.
  const isLong = text.length > 220;
  return (
    <div>
      <p
        className="leading-relaxed text-ink-soft"
        style={open || !isLong ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 text-sm font-bold text-forest-700 underline underline-offset-2 hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {open ? "Leer menos" : "Leer más"}
        </button>
      )}
    </div>
  );
}
