"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Aviso descartable (se recuerda en este navegador; sin localStorage queda siempre visible).
 * Arranca visible para no parpadear y se oculta al montar si ya se descartó.
 */
export function DismissibleNote({ storageKey, children, className = "" }: { storageKey: string; children: ReactNode; className?: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") setHidden(true);
    } catch {
      /* sin storage: queda visible */
    }
  }, [storageKey]);

  if (hidden) return null;
  return (
    <div role="note" className={`relative ${className}`}>
      {children}
      <button
        type="button"
        aria-label="Descartar aviso"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(storageKey, "1");
          } catch {
            /* ignorar */
          }
        }}
        className="absolute right-1.5 top-1.5 flex size-11 items-center justify-center rounded-full text-ink-faint hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Icon name="close" className="text-xl" />
      </button>
    </div>
  );
}
