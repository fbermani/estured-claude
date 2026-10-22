"use client";

import { useState } from "react";

/** Copia `value` al portapapeles. `label` describe qué se copia (accesibilidad). */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={`Copiar ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 rounded-full border-[1.5px] border-line-2 bg-paper px-3 py-1 text-xs font-bold text-ink hover:border-forest hover:bg-forest-tint"
    >
      <span aria-live="polite">{copied ? "¡Copiado!" : "Copiar"}</span>
    </button>
  );
}
