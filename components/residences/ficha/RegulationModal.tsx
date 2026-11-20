"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";

/**
 * DR30 §3: el reglamento completo se lee en un modal (y se descarga) en vez de ocupar una sección de la ficha.
 * El texto llega ya renderizado desde el servidor (`children`); acá solo vive el estado abierto/cerrado.
 */
export function RegulationModal({
  title,
  intro,
  footnote,
  downloadHref,
  children,
}: {
  title: string;
  intro: string;
  footnote?: string | null;
  /** Descarga del reglamento (la residencia cargó el suyo); `null` = no se ofrece descarga (rige el modelo base). */
  downloadHref: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const btn =
    "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-[15px] font-semibold text-ink transition-colors hover:border-forest hover:bg-forest-tint hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        <Icon name="article" className="text-base" />
        Leer reglamento
      </button>
      {downloadHref && (
        <a href={downloadHref} download className={btn}>
          <Icon name="download" className="text-base" />
          Descargar el reglamento
        </a>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="reglamento-title" maxWidthClass="sm:max-w-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="reglamento-title" className="text-lg font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            data-autofocus
            className="rounded-full p-1 text-ink-soft hover:bg-cream-2"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="mb-4 text-sm text-ink-soft">{intro}</p>
          {children}
          {footnote && <p className="mt-4 text-xs text-ink-faint">{footnote}</p>}
        </div>
        {downloadHref && (
          <div className="border-t border-line px-5 py-3">
            <a href={downloadHref} download className={btn}>
              <Icon name="download" className="text-base" />
              Descargar
            </a>
          </div>
        )}
      </Dialog>
    </>
  );
}
